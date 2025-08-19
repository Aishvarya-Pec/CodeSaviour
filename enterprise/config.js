module.exports = {
    // CI/CD Configuration
    cicd: {
        qualityGates: {
            minQualityScore: 80,
            minSecurityScore: 90,
            minPerformanceScore: 85,
            maxCriticalIssues: 0,
            maxHighIssues: 5
        },
        notifications: {
            slack: {
                webhook: process.env.SLACK_WEBHOOK_URL,
                channel: '#codesaviour-alerts'
            },
            email: {
                smtp: process.env.SMTP_SERVER,
                recipients: process.env.ALERT_RECIPIENTS?.split(',') || []
            }
        }
    },

    // Performance Monitoring
    monitoring: {
        thresholds: {
            analysisTime: 5000, // ms
            memoryUsage: 512 * 1024 * 1024, // 512MB
            cpuUsage: 80, // %
            throughput: 1000 // chars/ms
        },
        retention: {
            metrics: 30 * 24 * 60 * 60 * 1000, // 30 days
            alerts: 90 * 24 * 60 * 60 * 1000, // 90 days
            reports: 365 * 24 * 60 * 60 * 1000 // 1 year
        }
    },

    // API Configuration
    api: {
        port: process.env.API_PORT || 8080,
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // requests per window
        },
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*']
        }
    },

    // Dashboard Configuration
    dashboard: {
        port: process.env.DASHBOARD_PORT || 3000,
        auth: {
            enabled: process.env.DASHBOARD_AUTH === 'true',
            secret: process.env.DASHBOARD_SECRET || 'change-me'
        }
    },

    // Integration Settings
    integrations: {
        github: {
            token: process.env.GITHUB_TOKEN,
            webhookSecret: process.env.GITHUB_WEBHOOK_SECRET
        },
        gitlab: {
            token: process.env.GITLAB_TOKEN,
            webhookSecret: process.env.GITLAB_WEBHOOK_SECRET
        },
        jira: {
            url: process.env.JIRA_URL,
            username: process.env.JIRA_USERNAME,
            token: process.env.JIRA_TOKEN
        }
    }
};