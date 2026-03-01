# $ finanzas

App de finanzas personales.

## Deploy en Vercel

### Opción A: Deploy desde GitHub (recomendado)

1. Crear repositorio en GitHub
2. Subir este código
3. Ir a vercel.com → "Add New Project" → importar el repo
4. En "Environment Variables" agregar:
   - `VITE_SUPABASE_URL` = tu URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = tu anon key de Supabase
5. Click "Deploy"

### Opción B: Deploy con Vercel CLI

```bash
npm install
npx vercel
```

## Desarrollo local

```bash
npm install
npm run dev
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar con tus datos de Supabase.
