import fs from 'fs';
import path from 'path';

export interface DocPage {
  slug: string;
  title: string;
  category: string;
  order: number;
  content: string;
}

const docsDirectory = path.join(process.cwd(), 'src/content/docs');

export function getDocSlugs() {
  if (!fs.existsSync(docsDirectory)) return [];
  return fs.readdirSync(docsDirectory).filter(file => file.endsWith('.md'));
}

export function getDocBySlug(slug: string): DocPage | null {
  const realSlug = slug.replace(/\.md$/, '');
  const fullPath = path.join(docsDirectory, `${realSlug}.md`);
  
  if (!fs.existsSync(fullPath)) return null;
  
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  
  // Simple frontmatter parser
  // Matches:
  // ---
  // title: "My Title"
  // category: "My Category"
  // order: 1
  // ---
  // Content...
  
  const frontmatterRegex = /---\n([\s\S]*?)\n---/;
  const match = frontmatterRegex.exec(fileContents);
  
  let title = realSlug;
  let category = 'General';
  let order = 99;
  let content = fileContents;
  
  if (match) {
    const frontmatter = match[1];
    content = fileContents.replace(frontmatterRegex, '').trim();
    
    const lines = frontmatter.split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split(':');
      if (key && rest.length > 0) {
        const k = key.trim();
        const v = rest.join(':').trim().replace(/^['"](.*)['"]$/, '$1'); // remove quotes
        
        if (k === 'title') title = v;
        if (k === 'category') category = v;
        if (k === 'order') order = parseInt(v, 10);
      }
    }
  }

  return {
    slug: realSlug,
    title,
    category,
    order,
    content,
  };
}

export function getAllDocs(): DocPage[] {
  const slugs = getDocSlugs();
  const docs = slugs
    .map((slug) => getDocBySlug(slug))
    .filter((doc): doc is DocPage => doc !== null)
    .sort((a, b) => a.order - b.order);
    
  return docs;
}
