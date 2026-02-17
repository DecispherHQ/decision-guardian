import { validatePrivacy } from '../../src/telemetry/privacy';

describe('validatePrivacy', () => {
    it('should pass for clean payloads', () => {
        expect(() =>
            validatePrivacy({
                event: 'run_complete',
                version: '1.0.0',
                metrics: { files_processed: 5 },
            })
        ).not.toThrow();
    });

    it('should throw for blocked top-level fields', () => {
        expect(() =>
            validatePrivacy({
                event: 'run_complete',
                repo_name: 'secret-repo',
            })
        ).toThrow('Telemetry privacy violation');
    });

    it('should throw for blocked nested fields', () => {
        expect(() =>
            validatePrivacy({
                event: 'run_complete',
                context: { file_names: ['a.ts'] },
            })
        ).toThrow('blocked fields found: context.file_names');
    });

    it('should detect multiple violations', () => {
        expect(() =>
            validatePrivacy({
                repo_name: 'x',
                author: 'y',
                email: 'z',
            })
        ).toThrow(/repo_name/);
    });

    it('should be case-insensitive and block mixed-case fields', () => {
        expect(() =>
            validatePrivacy({
                event: 'run_complete',
                Repo_Name: 'secret-repo',
            })
        ).toThrow(/Repo_Name/i);
    });
});

