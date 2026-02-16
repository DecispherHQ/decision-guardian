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
exports.runTemplate = runTemplate;
exports.listTemplates = listTemplates;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const paths_1 = require("../paths");
const AVAILABLE = ['basic', 'advanced-rules', 'security', 'database', 'api'];
function runTemplate(name, outputPath) {
    if (!AVAILABLE.includes(name)) {
        console.error(`\x1b[31m✗\x1b[0m  Unknown template: "${name}"`);
        listTemplates();
        process.exit(1);
    }
    const templatePath = path.join((0, paths_1.getTemplatesDir)(), `${name}.md`);
    if (!fs.existsSync(templatePath)) {
        console.error(`\x1b[31m✗\x1b[0m  Template file missing: ${templatePath}`);
        process.exit(1);
    }
    const content = fs.readFileSync(templatePath, 'utf-8');
    if (outputPath) {
        const resolved = path.resolve(outputPath);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, content, 'utf-8');
        console.log(`\x1b[32m✔\x1b[0m  Written to ${resolved}`);
    }
    else {
        console.log(content);
    }
}
function listTemplates() {
    console.log('\nAvailable templates:');
    for (const name of AVAILABLE) {
        console.log(`  • ${name}`);
    }
    console.log('');
}
