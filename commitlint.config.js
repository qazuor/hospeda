export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'body-max-line-length': [0, 'always'],
        'footer-max-line-length': [0, 'always'],
        'header-case': [0, 'always', ['sentence-case', 'lower-case']],
        'body-case': [0, 'always', ['sentence-case', 'lower-case']],
        'scope-case': [0, 'always', ['lower-case']],
        'type-case': [0, 'always', ['lower-case']],
        'subject-case': [0, 'always', ['sentence-case']],
        'type-enum': [
            2,
            'always',
            [
                'feat',
                'fix',
                'docs',
                'style',
                'refactor',
                'perf',
                'test',
                'revert',
                'build',
                'ci',
                'workflow',
                'types',
                'del',
                'misc'
            ]
        ]
    }
};
