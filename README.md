# G4T1_SPM

## 🚀 Local Development with Supabase
This is a minimal Docker Compose setup for self-hosting Supabase. Follow the steps [here](https://supabase.com/docs/guides/hosting/docker) to get started.
This project uses the official Supabase Docker setup to provide a complete local development environment that mirrors production, including the Supabase Studio dashboard.

### Prerequisites

  * [Docker](https://docs.docker.com/get-docker/)
  * [Docker Compose](https://docs.docker.com/compose/install/)

### Local Setup

1.  **Clone the repository.**

    ```bash
    git clone https://github.com/WeiShenL/G4T1_SPM
    cd G4T1_SPM
    ```

2.  **Set up Environment Variables**
    In the project **root**, create your local environment file by copying the template.

    ```bash
    cp .env.example .env
    ```

    The default placeholders in the `.env` file will work for local development.
    
3.  **Start the Supabase Stack**
    All Docker commands must be run from *inside* the `supabase` directory.

    First, navigate into the folder:

    ```bash
    cd supabase
    ```

    Then, start all the services using the following command:

    ```bash
    docker compose --env-file ../.env up -d
    ```

    This command explicitly tells Docker to use the `.env` file from the project root, ensuring a reliable startup. The first run may take several minutes to download all the necessary container images.

4.  **Access Supabase Studio**
    Once the containers are running, you can access the local Supabase dashboard in your browser at:
    **[http://localhost:8000](https://www.google.com/search?q=http://localhost:8000)**

5.  **Stopping the Services**
    To stop all running containers, make sure you are still inside the `supabase` directory and run:

    ```bash
    docker compose --env-file ../.env down
    ```