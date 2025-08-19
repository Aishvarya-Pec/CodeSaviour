const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { CodeSaviourEngine } = require('../codesaviour-engine.js');
const PerformanceMonitor = require('./performance-monitor.js');

class APIServer {
    constructor(options = {}) {
        this.app = express();
        this.port = options.port || 8080;
        this.engine = new CodeSaviourEngine(options.engineOptions);
        this.monitor = new PerformanceMonitor();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Security
        this.app.use(helmet());
        this.app.use(cors());
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP'
        });
        this.app.use('/api/', limiter);
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: require('../package.json').version
            });
        });

        // Code analysis endpoints
        this.app.post('/api/v1/analyze', this.analyzeCode.bind(this));
        this.app.post('/api/v1/analyze/batch', this.analyzeBatch.bind(this));
        this.app.post('/api/v1/fix', this.fixCode.bind(this));
        
        // Reporting endpoints
        this.app.get('/api/v1/reports/:id', this.getReport.bind(this));
        this.app.get('/api/v1/metrics', this.getMetrics.bind(this));
        
        // Webhook endpoints
        this.app.post('/api/v1/webhooks/github', this.handleGitHubWebhook.bind(this));
        this.app.post('/api/v1/webhooks/gitlab', this.handleGitLabWebhook.bind(this));
        
        // Error handling
        this.app.use(this.errorHandler.bind(this));
    }

    async analyzeCode(req, res) {
        try {
            const { code, filePath, options = {} } = req.body;
            
            if (!code) {
                return res.status(400).json({
                    success: false,
                    error: 'Code is required'
                });
            }

            const startTime = Date.now();
            const result = await this.engine.analyzeCode(code, filePath, options);
            const analysisTime = Date.now() - startTime;

            // Record metrics
            this.monitor.recordAnalysis(
                filePath || 'api-request',
                analysisTime,
                code.length,
                result.issues?.length || 0
            );

            res.json({
                success: true,
                data: result,
                metadata: {
                    analysisTime,
                    codeSize: code.length,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    async analyzeBatch(req, res) {
        try {
            const { files, options = {} } = req.body;
            
            if (!Array.isArray(files) || files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Files array is required'
                });
            }

            const results = [];
            const startTime = Date.now();

            for (const file of files) {
                const result = await this.engine.analyzeCode(file.code, file.path, options);
                results.push({
                    filePath: file.path,
                    result
                });
            }

            const totalTime = Date.now() - startTime;

            res.json({
                success: true,
                data: results,
                metadata: {
                    totalFiles: files.length,
                    totalTime,
                    avgTimePerFile: totalTime / files.length,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    async fixCode(req, res) {
        try {
            const { code, filePath, options = {} } = req.body;
            
            if (!code) {
                return res.status(400).json({
                    success: false,
                    error: 'Code is required'
                });
            }

            const result = await this.engine.fixCode(code, options);

            res.json({
                success: true,
                data: result,
                metadata: {
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    async handleGitHubWebhook(req, res) {
        try {
            const event = req.headers['x-github-event'];
            const payload = req.body;

            if (event === 'push') {
                // Analyze changed files
                const results = await this.analyzeGitHubPush(payload);
                
                // Post results as PR comment if applicable
                if (payload.pull_request) {
                    await this.postGitHubComment(payload, results);
                }
            }

            res.json({ success: true, message: 'Webhook processed' });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    async handleGitLabWebhook(req, res) {
        try {
            const event = req.headers['x-gitlab-event'];
            const payload = req.body;

            if (event === 'Push Hook') {
                const results = await this.analyzeGitLabPush(payload);
                // Handle GitLab-specific logic
            }

            res.json({ success: true, message: 'Webhook processed' });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    handleError(res, error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }

    errorHandler(error, req, res, next) {
        console.error('Unhandled error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🚀 CodeSaviour API Server running on port ${this.port}`);
        });
    }
}

module.exports = APIServer;