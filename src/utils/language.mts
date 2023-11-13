export function kebabify(str: string): string {
    return str.replace(/[^A-Za-z]/g, '-')
        .split(/(?=[A-Z])/)
        .join('-')
        .replace(/-+/gi,'-')
        .toLowerCase();
}
