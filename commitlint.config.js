export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'body-max-line-length': [0, 'always'],
        'footer-max-line-length': [0, 'always'],
        'header-case': [0, 'always', ['sentence-case', 'lower-case']],
        'body-case': [0, 'always', ['sentence-case', 'lower-case']],
        'scope-case': [0, 'always', ['lower-case']],
        'type-case': [2, 'always', 'lower-case'],
        'type-empty': [2, 'never'],
        'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
        'subject-empty': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'header-max-length': [2, 'always', 100],
        'type-enum': [
            2,
            'always',
            [
                'feat', // Nueva funcionalidad
                'fix', // Corrección de bug
                'docs', // Documentación
                'style', // Formato, punto y coma faltante, etc.
                'refactor', // Refactorización de código
                'test', // Agregar tests
                'chore', // Tareas de mantenimiento
                'perf', // Mejora de performance
                'ci', // Cambios en CI
                'build', // Cambios en build
                'revert', // Revertir commit,
                'workflow',
                'types',
                'del',
                'misc'
            ]
        ]
    }
};
