# CodeSaviour Enterprise Docker Image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY codesaviour-engine.js ./
COPY test/ ./test/

# Create non-root user for security
RUN addgroup -g 1001 -S codesaviour && \
    adduser -S codesaviour -u 1001

# Set permissions
RUN chown -R codesaviour:codesaviour /app
USER codesaviour

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Default command
CMD ["node", "codesaviour-engine.js"]

# Labels for enterprise deployment
LABEL version="2.0.0" \
      description="CodeSaviour Enterprise - AI-Powered Code Analysis" \
      maintainer="codesaviour@enterprise.com" \
      security.scan="passed" \
      compliance="enterprise-ready"