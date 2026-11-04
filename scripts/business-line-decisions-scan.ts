import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

export type DecisionHit = { file: string; line: number; reason: string };
export type ReaderHit = { file: string; symbol: string; line: number };
export type ScanResult = {
    scannedFiles: number;
    decisions: DecisionHit[];
    readers: ReaderHit[];
    imports: string[];
};

const DECLARATIONS = /(?:\.d\.ts|\.test\.[jt]sx?$)/;
function lineOf(node: ts.Node, sf: ts.SourceFile): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}
function businessLineType(type: ts.Type, checker: ts.TypeChecker): boolean {
    const symbol = type.aliasSymbol ?? type.getSymbol();
    if (symbol?.getName() === 'BusinessLine' || symbol?.getName() === 'BusinessLineValue')
        return true;
    if (type.isUnionOrIntersection())
        return type.types.some((part) => businessLineType(part, checker));
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
        const element = checker.getTypeArguments(type as ts.TypeReference)[0];
        return !!element && businessLineType(element, checker);
    }
    return false;
}
function hasBusinessLineAnnotation(node: ts.Node, checker: ts.TypeChecker): boolean {
    const symbols = [checker.getSymbolAtLocation(node)];
    if (ts.isPropertyAccessExpression(node)) symbols.push(checker.getSymbolAtLocation(node.name));
    for (const symbol of symbols) {
        for (const declaration of symbol?.declarations ?? []) {
            const declaredType = 'type' in declaration ? declaration.type : undefined;
            if (!declaredType) continue;
            let found = false;
            const visit = (current: ts.Node): void => {
                if (
                    ts.isTypeReferenceNode(current) &&
                    ts.isIdentifier(current.typeName) &&
                    ['BusinessLine', 'BusinessLineValue'].includes(
                        checker.getSymbolAtLocation(current.typeName)?.getName() ??
                            current.typeName.text
                    )
                )
                    found = true;
                ts.forEachChild(current, visit);
            };
            visit(declaredType);
            if (found) return true;
        }
    }
    return false;
}
function symbolName(node: ts.Node): string {
    for (let current: ts.Node | undefined = node; current; current = current.parent) {
        if ((ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) && current.name)
            return current.name.getText();
        if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name))
            return current.name.text;
    }
    return '<module>';
}

export function scanBusinessLineDecisions(root: string): ScanResult {
    const decisions: DecisionHit[] = [];
    const readers: ReaderHit[] = [];
    const imports: string[] = [];
    const relevant = new Set([
        'apps/admin',
        'apps/api',
        'apps/web',
        'apps/mobile',
        'packages/ai-core',
        'packages/billing-verticals-contract',
        'packages/db',
        'packages/feedback',
        'packages/schemas',
        'packages/seed',
        'packages/service-core',
        'packages/verticals'
    ]);
    const tsconfigs = ['apps', 'packages']
        .filter((group) => existsSync(join(root, group)))
        .flatMap((group) =>
            readdirSync(join(root, group), { withFileTypes: true })
                .filter((entry) => entry.isDirectory() && relevant.has(`${group}/${entry.name}`))
                .map((entry) => join(root, group, entry.name, 'tsconfig.json'))
        );
    const visited = new Set<string>();
    for (const config of tsconfigs) {
        const parsed = ts.getParsedCommandLineOfConfigFile(
            config,
            {},
            {
                ...ts.sys,
                onUnRecoverableConfigFileDiagnostic: () => undefined
            }
        );
        if (!parsed) continue;
        const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
        const checker = program.getTypeChecker();
        for (const sourceFile of program.getSourceFiles()) {
            const abs = sourceFile.fileName;
            const file = relative(root, abs).replaceAll('\\', '/');
            if (
                !/^apps\/[^/]+\/src\/|^packages\/[^/]+\/src\//.test(file) ||
                DECLARATIONS.test(file) ||
                visited.has(file)
            )
                continue;
            visited.add(file);
            const verticalsDir = 'packages/verticals/src/listing-sections/';
            const permittedDecision = file.startsWith(verticalsDir);
            const addDecision = (node: ts.Node, reason: string) => {
                if (!permittedDecision)
                    decisions.push({ file, line: lineOf(node, sourceFile), reason });
            };
            const visit = (node: ts.Node): void => {
                if (
                    (ts.isPropertyAccessExpression(node) && node.name.text === 'businessLines') ||
                    (ts.isElementAccessExpression(node) &&
                        node.argumentExpression &&
                        ts.isStringLiteral(node.argumentExpression) &&
                        node.argumentExpression.text === 'businessLines')
                ) {
                    readers.push({
                        file,
                        symbol: symbolName(node),
                        line: lineOf(node, sourceFile)
                    });
                }
                if (
                    ts.isBindingElement(node) &&
                    (node.propertyName?.getText(sourceFile) === 'businessLines' ||
                        (!node.propertyName &&
                            ts.isIdentifier(node.name) &&
                            node.name.text === 'businessLines'))
                ) {
                    readers.push({
                        file,
                        symbol: symbolName(node),
                        line: lineOf(node, sourceFile)
                    });
                }
                if (
                    ts.isImportDeclaration(node) &&
                    node.importClause?.namedBindings &&
                    ts.isNamedImports(node.importClause.namedBindings)
                ) {
                    const imported = node.importClause.namedBindings.elements.some((e) =>
                        ['BUSINESS_LINES', 'BUSINESS_LINE_RULES'].includes(
                            e.propertyName?.text ?? e.name.text
                        )
                    );
                    if (imported) imports.push(file);
                }
                if (
                    ts.isBinaryExpression(node) &&
                    [
                        ts.SyntaxKind.EqualsEqualsEqualsToken,
                        ts.SyntaxKind.ExclamationEqualsEqualsToken,
                        ts.SyntaxKind.EqualsEqualsToken,
                        ts.SyntaxKind.ExclamationEqualsToken
                    ].includes(node.operatorToken.kind)
                ) {
                    if (
                        businessLineType(checker.getTypeAtLocation(node.left), checker) ||
                        businessLineType(checker.getTypeAtLocation(node.right), checker) ||
                        hasBusinessLineAnnotation(node.left, checker) ||
                        hasBusinessLineAnnotation(node.right, checker)
                    )
                        addDecision(node, 'comparison operand has type BusinessLine');
                }
                if (
                    ts.isSwitchStatement(node) &&
                    businessLineType(checker.getTypeAtLocation(node.expression), checker)
                )
                    addDecision(node, 'switch operand has type BusinessLine');
                if (
                    ts.isElementAccessExpression(node) &&
                    node.argumentExpression &&
                    businessLineType(checker.getTypeAtLocation(node.argumentExpression), checker)
                )
                    addDecision(node, 'index has type BusinessLine');
                if (
                    ts.isPropertyAssignment(node) &&
                    ts.isComputedPropertyName(node.name) &&
                    businessLineType(checker.getTypeAtLocation(node.name.expression), checker)
                )
                    addDecision(node, 'object key has type BusinessLine');
                if (
                    ts.isCallExpression(node) &&
                    ts.isPropertyAccessExpression(node.expression) &&
                    ['includes', 'some', 'indexOf', 'every', 'find'].includes(
                        node.expression.name.text
                    )
                ) {
                    const receiver = checker.getTypeAtLocation(node.expression.expression);
                    const callbackHasBusinessLine = node.arguments.some((arg) => {
                        if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) return false;
                        return arg.parameters.some((param) =>
                            businessLineType(checker.getTypeAtLocation(param), checker)
                        );
                    });
                    if (
                        businessLineType(receiver, checker) ||
                        hasBusinessLineAnnotation(node.expression.expression, checker) ||
                        callbackHasBusinessLine
                    )
                        addDecision(node, `${node.expression.name.text} operates on BusinessLine`);
                }
                ts.forEachChild(node, visit);
            };
            visit(sourceFile);
        }
    }
    return { scannedFiles: visited.size, decisions, readers, imports: [...new Set(imports)] };
}
