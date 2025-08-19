const EventEmitter = require('events');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.metrics = new Map();
        this.alerts = [];
        this.thresholds = {
            analysisTime: options.analysisTimeThreshold || 5000,
            memoryUsage: options.memoryThreshold || 512 * 1024 * 1024, // 512MB
            cpuUsage: options.cpuThreshold || 80,
            throughput: options.throughputThreshold || 1000
        };
        this.reportInterval = options.reportInterval || 60000; // 1 minute
        this.startMonitoring();
    }

    startMonitoring() {
        setInterval(() => {
            this.collectSystemMetrics();
            this.checkThresholds();
            this.generateReport();
        }, this.reportInterval);
    }

    recordAnalysis(filePath, analysisTime, codeSize, issues) {
        const timestamp = Date.now();
        const metric = {
            timestamp,
            filePath,
            analysisTime,
            codeSize,
            issues,
            throughput: codeSize / analysisTime,
            memoryUsage: process.memoryUsage()
        };

        this.metrics.set(`analysis_${timestamp}`, metric);
        this.emit('analysis_recorded', metric);

        // Check for performance degradation
        if (analysisTime > this.thresholds.analysisTime) {
            this.createAlert('SLOW_ANALYSIS', `Analysis took ${analysisTime}ms for ${filePath}`);
        }
    }

    collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const systemMetric = {
            timestamp: Date.now(),
            memory: {
                rss: memUsage.rss,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: process.uptime()
        };

        this.metrics.set(`system_${systemMetric.timestamp}`, systemMetric);
    }

    checkThresholds() {
        const memUsage = process.memoryUsage();
        
        if (memUsage.heapUsed > this.thresholds.memoryUsage) {
            this.createAlert('HIGH_MEMORY', `Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
        }
    }

    createAlert(type, message) {
        const alert = {
            id: `alert_${Date.now()}`,
            type,
            message,
            timestamp: new Date().toISOString(),
            severity: this.getAlertSeverity(type)
        };

        this.alerts.push(alert);
        this.emit('alert_created', alert);

        // Send to external monitoring systems
        this.sendToMonitoringSystems(alert);
    }

    getAlertSeverity(type) {
        const severityMap = {
            'SLOW_ANALYSIS': 'warning',
            'HIGH_MEMORY': 'critical',
            'HIGH_CPU': 'warning',
            'LOW_THROUGHPUT': 'warning'
        };
        return severityMap[type] || 'info';
    }

    async sendToMonitoringSystems(alert) {
        // Send to Slack
        if (process.env.SLACK_WEBHOOK_URL) {
            await this.sendSlackAlert(alert);
        }

        // Send to PagerDuty
        if (process.env.PAGERDUTY_API_KEY && alert.severity === 'critical') {
            await this.sendPagerDutyAlert(alert);
        }

        // Log to file
        await this.logAlert(alert);
    }

    async sendSlackAlert(alert) {
        const webhook = process.env.SLACK_WEBHOOK_URL;
        const payload = {
            text: `🚨 CodeSaviour Alert: ${alert.type}`,
            attachments: [{
                color: alert.severity === 'critical' ? 'danger' : 'warning',
                fields: [
                    { title: 'Message', value: alert.message, short: false },
                    { title: 'Severity', value: alert.severity, short: true },
                    { title: 'Time', value: alert.timestamp, short: true }
                ]
            }]
        };

        try {
            const response = await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Failed to send Slack alert:', error);
        }
    }

    async logAlert(alert) {
        const logDir = path.join(process.cwd(), 'logs');
        await fs.mkdir(logDir, { recursive: true });
        
        const logFile = path.join(logDir, `alerts-${new Date().toISOString().split('T')[0]}.log`);
        const logEntry = `${alert.timestamp} [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}\n`;
        
        await fs.appendFile(logFile, logEntry);
    }

    async generateReport() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        
        const recentMetrics = Array.from(this.metrics.values())
            .filter(metric => metric.timestamp > oneHourAgo);
        
        const analysisMetrics = recentMetrics.filter(m => m.filePath);
        const systemMetrics = recentMetrics.filter(m => m.memory);
        
        const report = {
            timestamp: new Date().toISOString(),
            period: '1 hour',
            analysis: {
                count: analysisMetrics.length,
                avgTime: analysisMetrics.reduce((sum, m) => sum + m.analysisTime, 0) / analysisMetrics.length || 0,
                avgThroughput: analysisMetrics.reduce((sum, m) => sum + m.throughput, 0) / analysisMetrics.length || 0,
                totalIssues: analysisMetrics.reduce((sum, m) => sum + m.issues, 0)
            },
            system: {
                avgMemoryUsage: systemMetrics.reduce((sum, m) => sum + m.memory.heapUsed, 0) / systemMetrics.length || 0,
                peakMemoryUsage: Math.max(...systemMetrics.map(m => m.memory.heapUsed)),
                uptime: process.uptime()
            },
            alerts: this.alerts.filter(a => new Date(a.timestamp).getTime() > oneHourAgo)
        };

        // Save report
        const reportDir = path.join(process.cwd(), 'reports', 'performance');
        await fs.mkdir(reportDir, { recursive: true });
        
        const reportFile = path.join(reportDir, `performance-${new Date().toISOString().split('T')[0]}.json`);
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

        this.emit('report_generated', report);
        return report;
    }

    getMetrics(timeRange = '1h') {
        const now = Date.now();
        const ranges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };
        
        const cutoff = now - (ranges[timeRange] || ranges['1h']);
        return Array.from(this.metrics.values())
            .filter(metric => metric.timestamp > cutoff);
    }

    clearOldMetrics(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
        const cutoff = Date.now() - maxAge;
        for (const [key, metric] of this.metrics.entries()) {
            if (metric.timestamp < cutoff) {
                this.metrics.delete(key);
            }
        }
    }
}

module.exports = PerformanceMonitor;