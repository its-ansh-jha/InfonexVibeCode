import { readFileSync } from 'fs';
import path from 'path';
import { writeFileToSandbox } from './e2b';
import { uploadFileToS3 } from './s3';
import { storage } from '../storage';

export interface BoilerplateFile {
  path: string;
  content: string;
}

export async function getBoilerplateTemplate(type: 'react-vite' | 'node-express'): Promise<BoilerplateFile[]> {
  if (type === 'react-vite') {
    return [
      {
        path: 'vite.config.ts',
        content: readFileSync(path.join(process.cwd(), 'server/templates/vite.config.template.ts'), 'utf-8'),
      },
      {
        path: 'package.json',
        content: readFileSync(path.join(process.cwd(), 'server/templates/package.template.json'), 'utf-8'),
      },
      {
        path: 'index.html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`,
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Vibe Code</h1>
      <p>AI-Powered Coding Platform</p>
      <div style={{ margin: '20px' }}>
        <button onClick={() => setCount(count + 1)}>
          Count is {count}
        </button>
      </div>
    </div>
  );
}

export default App;`,
      },
      {
        path: 'src/index.css',
        content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`,
      },
      {
        path: 'tsconfig.json',
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,
      },
      {
        path: 'tsconfig.node.json',
        content: `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`,
      },
    ];
  }
  
  return [];
}

export async function createBoilerplateProject(
  projectId: string,
  type: 'react-vite' | 'node-express'
): Promise<void> {
  const files = await getBoilerplateTemplate(type);
  
  for (const file of files) {
    const s3Key = await uploadFileToS3(projectId, file.path, file.content);
    await writeFileToSandbox(projectId, file.path, file.content);
    
    const existingFile = await storage.getFileByPath(projectId, file.path);
    if (!existingFile) {
      await storage.createFile({
        projectId,
        path: file.path,
        s3Key,
        size: Buffer.byteLength(file.content, 'utf-8'),
      });
    }
  }
}
