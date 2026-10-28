FROM ubuntu:24.04

LABEL org.opencontainers.image.source="https://github.com/ust-aws/aws-pokedex-workspace"
LABEL org.opencontainers.image.description="Workspace environment for AWS Pokédex"

ENV DEBIAN_FRONTEND=noninteractive

# Install base dependencies and NodeSource repository for Node.js 24 LTS
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv \
    unzip \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2 dynamically based on target architecture (x86_64 vs aarch64)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
    AWS_ARCH="x86_64"; \
    elif [ "$ARCH" = "aarch64" ]; then \
    AWS_ARCH="aarch64"; \
    else \
    echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o "awscliv2.zip" && \
    unzip -q awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip ./aws

# Create workspace directory and ensure ownership for the default non-root user (ubuntu, UID/GID 1000)
WORKDIR /workspace
RUN chown -R ubuntu:ubuntu /workspace

# Copy files and install dependencies as non-root user
USER ubuntu
COPY --chown=ubuntu:ubuntu . .
RUN npm ci

CMD ["bash"]