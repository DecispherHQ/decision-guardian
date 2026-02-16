"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInit = runInit;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const paths_1 = require("../paths");
function runInit(templateName) {
    const targetDir = path.resolve('.decispher');
    const targetFile = path.join(targetDir, 'decisions.md');
    if (fs.existsSync(targetFile)) {
        console.log(`\x1b[33m⚠\x1b[0m  ${targetFile} already exists. Skipping.`);
        return;
    }
    const templatePath = path.join((0, paths_1.getTemplatesDir)(), `${templateName}.md`);
    if (!fs.existsSync(templatePath)) {
        console.error(`\x1b[31m✗\x1b[0m  Template "${templateName}" not found.`);
        console.log('Available: basic, advanced-rules, security, database, api');
        process.exit(1);
    }
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(templatePath, targetFile);
    console.log(`\x1b[32m✔\x1b[0m  Created ${targetFile}`);
    console.log(`   Template: ${templateName}`);
    console.log(`\n   Edit the file to define your architectural decisions.`);
}
