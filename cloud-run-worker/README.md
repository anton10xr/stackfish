# Cloud Run Worker

This folder contains the code and setup for the worker running on Google Cloud Run. It executes and tests solutions in a safe, isolated environment.

## Setup

### Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/)
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)

### Installation Steps

1. **Authenticate Docker with GCloud**

   ```bash
   gcloud auth configure-docker
   ```

2. **Build & Push the Docker Image**

   ```bash
   docker build -t gcr.io/<YOUR_PROJECT_ID>/cloud-run-worker .
   docker push gcr.io/<YOUR_PROJECT_ID>/cloud-run-worker
   ```

3. **Deploy on Cloud Run**

   ```bash
   gcloud run deploy cloud-run-worker \
     --image gcr.io/<YOUR_PROJECT_ID>/cloud-run-worker \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --max-instances 100 \
     --concurrency 1 \
     --timeout 600s \
     --cpu 2 \
     --memory 8Gi \
     --port 8080
   ```

   After deploying, you'll get a URL like:
   `https://cloud-run-worker-xxxxxx-uc.a.run.app`

4. **Grant Storage Permissions**
   Make sure the service account has Storage permissions so it can handle large input/output files:
   ```bash
   gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> \
     --member="serviceAccount:<YOUR_SERVICE_ACCOUNT>" \
     --role="roles/storage.objectAdmin"
   ```

## Done!

Your Cloud Run worker is now ready to be integrated with the rest of the pipeline.
