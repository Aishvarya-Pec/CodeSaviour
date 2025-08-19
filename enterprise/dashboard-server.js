const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { CodeSaviourEngine } = require('../codesaviour-engine.js');
const PerformanceMonitor = require('./performance-monitor.js');

class DashboardServer {
    constructor(options = {}) {
        this.app = express();
        this.port = options.port || 3000;
        this.engine = new CodeSaviourEngine();
        this.monitor = new PerformanceMonitor();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupRoutes() {
        this.app.use(express.static(path.join(__dirname, 'dashboard-ui')));
        this.app.use(express.json());

        // API Routes
        this.app.get('/api/metrics', this.getMetrics.bind(this));
        this.app.get('/api/reports', this.getReports.bind(this));
        this.app.get('/api/alerts', this.getAlerts.bind(this));
        this.app.post('/api/analyze', this.analyzeCode.bind(this));
        this.app.get('/api/trends', this.getTrends.bind(this));
        this.app.get('/api/health', this.getHealth.bind(this));

        // Dashboard UI
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'dashboard-ui', 'index.html'));
        });
    }

    async getMetrics(req, res) {
        try {
            const timeRange = req.query.range || '1h';
            const metrics = this.monitor.getMetrics(timeRange);
            res.json({
                success: true,
                data: metrics,
                summary: this.calculateMetricsSummary(metrics)
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getReports(req, res) {
        try {
            const reportsDir = path.join(process.cwd(), 'reports');
            const files = await fs.readdir(reportsDir, { recursive: true });
            const reports = [];

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(reportsDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    reports.push({
                        filename: file,
                        data: JSON.parse(content),
                        modified: (await fs.stat(filePath)).mtime
                    });
                }
            }

            res.json({ success: true, data: reports });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getAlerts(req, res) {
        try {
            const severity = req.query.severity;
            let alerts = this.monitor.alerts;
            
            if (severity) {
                alerts = alerts.filter(alert => alert.severity === severity);
            }

            res.json({ success: true, data: alerts });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async analyzeCode(req, res) {
        try {
            const { code, filePath } = req.body;
            const startTime = Date.now();
            
            const result = await this.engine.analyzeCode(code, filePath);
            const analysisTime = Date.now() - startTime;
            
            // Record performance metrics
            this.monitor.recordAnalysis(
                filePath || 'api-request',
                analysisTime,
                code.length,
                result.issues?.length || 0
            );

            res.json({ success: true, data: result, analysisTime });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getTrends(req, res) {
        try {
            const days = parseInt(req.query.days) || 7;
            const trends = await this.calculateTrends(days);
            res.json({ success: true, data: trends });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getHealth(req, res) {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: require('../package.json').version,
            metrics: {
                totalAnalyses: this.engine.getMetrics().totalAnalyses,
                activeAlerts: this.monitor.alerts.filter(a => a.severity === 'critical').length
            }
        };

        res.json(health);
    }

    calculateMetricsSummary(metrics) {
        const analysisMetrics = metrics.filter(m => m.filePath);
        const systemMetrics = metrics.filter(m => m.memory);

        return {
            totalAnalyses: analysisMetrics.length,
            avgAnalysisTime: analysisMetrics.reduce((sum, m) => sum + m.analysisTime, 0) / analysisMetrics.length || 0,
            avgThroughput: analysisMetrics.reduce((sum, m) => sum + m.throughput, 0) / analysisMetrics.length || 0,
            currentMemoryUsage: systemMetrics.length > 0 ? systemMetrics[systemMetrics.length - 1].memory.heapUsed : 0,
            peakMemoryUsage: Math.max(...systemMetrics.map(m => m.memory.heapUsed), 0)
        };
    }

    async calculateTrends(days) {
        const trends = {
            analysisVolume: [],
            performanceScore: [],
            securityScore: [],
            issueTypes: {}
        };

        // Implementation for trend calculation
        // This would analyze historical data and calculate trends
        
        return trends;
    }

    setupWebSocket() {
        const http = require('http');
        const socketIo = require('socket.io');
        
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);

        this.io.on('connection', (socket) => {
            console.log('Dashboard client connected');
            
            // Send real-time updates
            this.monitor.on('analysis_recorded', (metric) => {
                socket.emit('analysis_update', metric);
            });
            
            this.monitor.on('alert_created', (alert) => {
                socket.emit('alert_update', alert);
            });
            
            this.monitor.on('report_generated', (report) => {
                socket.emit('report_update', report);
            });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`📊 CodeSaviour Dashboard running on http://localhost:${this.port}`);
        });
    }
}

module.exports = DashboardServer;