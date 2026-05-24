# Proxy de Enviopack en Cloud Run

Servidor Express mínimo para actuar como proxy de las llamadas `rates` (tarifas) y `shipments` (envíos) de Enviopack. Las claves deben proporcionarse a través de variables de entorno o Secret Manager — NO escribas las credenciales (secretos) directamente en el código.

Desarrollo local

1. Copia `.env.example` a `.env` y completa los valores (solo para pruebas locales):

```
cp .env.example .env
```

2. Instala las dependencias y ejecuta:

```bash
npm install
npm start
```

Deploy to Cloud Run (recommended: use Secret Manager)

1. Create secrets in Secret Manager and grant Cloud Run service account access.
2. Deploy with `gcloud run deploy` and map secrets to env vars:

```powershell
gcloud run deploy enviopack-server --source=. --region=us-central1 --max-instances=1 --memory=256Mi --platform=managed --allow-unauthenticated --set-secrets="ENVIOPACK_API_KEY=enviopack-api-key:latest,ENVIOPACK_SECRET_KEY=enviopack-secret-key:latest"
```

Replace secret names with the ones you created. After deploy, the service exposes `/rates` and `/shipments` endpoints.
