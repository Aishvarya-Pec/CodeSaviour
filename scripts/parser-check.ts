#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ParseError {
  file: string;
  error: string;
  line?: number;
  column?: number;
}

interface CheckResult {
  file: string;
  passed: boolean;
  error?: string;
}

/**
 * Automated Parser Check Script
 * Runs 'node --check' on all JavaScript files to identify parse errors
 */
class ParserChecker {
  private errors: ParseError[] = [];
  private checked: number = 0;
  private passed: number = 0;

  async checkAllFiles(): Promise<void> {
    console.log('🔍 Starting parser checks on JavaScript files...\n');

    const jsFiles = this.findJavaScriptFiles('.');

    for (const file of jsFiles) {
      await this.checkFile(file);
    }

    this.printSummary();
  }

  private findJavaScriptFiles(dir: string, files: string[] = []): string[] {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !this.shouldSkipDirectory(item)) {
        this.findJavaScriptFiles(fullPath, files);
      } else if (stat.isFile() && item.endsWith('.js')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private shouldSkipDirectory(dirname: string): boolean {
    const skipDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];
    return skipDirs.includes(dirname);
  }

  private async checkFile(filePath: string): Promise<CheckResult> {
    this.checked++;
    
    try {
      execSync(`node --check "${filePath}"`, { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      this.passed++;
      console.log(`✅ ${filePath}`);
      
      return { file: filePath, passed: true };
    } catch (error: any) {
      const parseError: ParseError = {
        file: filePath,
        error: error.stderr || error.message
      };
      
      this.errors.push(parseError);
      console.log(`❌ ${filePath}: ${parseError.error}`);
      
      return { file: filePath, passed: false, error: parseError.error };
    }
  }

  private printSummary(): void {
    console.log('\n📊 Parser Check Summary:');
    console.log(`   Total files checked: ${this.checked}`);
    console.log(`   Passed: ${this.passed}`);
    console.log(`   Failed: ${this.errors.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Files with parse errors:');
      this.errors.forEach(error => {
        console.log(`   ${error.file}: ${error.error}`);
      });
    }
  }
}

const checker = new ParserChecker();
checker.checkAllFiles().catch(console.error);