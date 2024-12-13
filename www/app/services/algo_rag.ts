import fs from 'fs';
import path from 'path';
import { RAG_resource } from '../types/rag';

export function get_resources(): RAG_resource[] {
    const categories = fs.readdirSync(path.join(process.cwd(), 'app', 'services', 'algo_rag_data'));
    const resources: RAG_resource[] = [];

    categories.forEach(category => {
        const categoryPath = path.join(process.cwd(), 'app', 'services', 'algo_rag_data', category);
        const files = fs.readdirSync(categoryPath);

        files.forEach(file => {
            const resourcePath = path.join(categoryPath, file);
            const content = fs.readFileSync(resourcePath, 'utf-8').trim();
            const fileNameWithoutExt = file.split('.').slice(0, -1).join('.');
            const id = `${category}/${fileNameWithoutExt}`;
            const firstLine = content.split('\n')[0].trim();
            const title = firstLine.startsWith('//') ? firstLine.substring(2).trim() : `${category}/${file}`;
            resources.push({ 
                id,
                file_path: resourcePath,
                title,
                content
            });
        });
    });
    return resources;
}

function get_tag_content(tag: string): string | null {
    try {
        const all_resources = get_resources();
        const resource = all_resources.find(r => r.id === tag);
        if (!resource) {
            return null;
        }
        return resource.content;
    } catch (error) {
        console.error(`!!!! Error reading tag content for ${tag}:`);
        return null;
    }
}

export function get_techniques_from_tags(tags: string[]): Record<string, string> {
    return tags.reduce((acc, tag) => {
        const content = get_tag_content(tag);
        if (content) {
            acc[tag] = content;
        }
        return acc;
    }, {} as Record<string, string>);
}
