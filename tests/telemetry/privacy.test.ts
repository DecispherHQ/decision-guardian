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

    it('should accept a well-formed repo_hash', () => {
        expect(() =>
            validatePrivacy({
                event: 'run_complete',
                repo_hash: 'a1b2c3d4e5f60718',
            })
        ).not.toThrow();
    });

    it('should accept a null repo_hash (repository undeterminable)', () => {
        expect(() =>
            validatePrivacy({
                event: 'run_complete',
                repo_hash: null,
            })
        ).not.toThrow();
    });

    it('should throw if repo_hash carries a raw repository reference', () => {
        expect(() =>
            validatePrivacy({
                event: 'run_complete',
                repo_hash: 'github.com/acme/secret-project',
            })
        ).toThrow(/non-hashed value in hashed field: repo_hash/);
    });

    it('should throw if repo_hash is the wrong length or not hex', () => {
        expect(() => validatePrivacy({ repo_hash: 'abc' })).toThrow(/repo_hash/);
        expect(() => validatePrivacy({ repo_hash: 'A1B2C3D4E5F60718' })).toThrow(/repo_hash/);
        expect(() => validatePrivacy({ repo_hash: 'zzzzzzzzzzzzzzzz' })).toThrow(/repo_hash/);
    });

    it('should block raw remote/repo URL fields', () => {
        expect(() => validatePrivacy({ remote_url: 'git@github.com:a/b.git' })).toThrow(
            /remote_url/
        );
        expect(() => validatePrivacy({ repo_url: 'https://github.com/a/b' })).toThrow(/repo_url/);
    });
});

