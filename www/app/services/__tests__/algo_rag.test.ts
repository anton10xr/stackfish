import { get_resources } from '../algo_rag';

describe('algo_rag', () => {
    test('get_resources should return array of resources', () => {
        const resources = get_resources();
        console.log('Resources found:', resources);
        console.log('Total resources:', resources.length);
        
        // Basic test to ensure it returns an array
        expect(Array.isArray(resources)).toBe(true);
    });
}); 