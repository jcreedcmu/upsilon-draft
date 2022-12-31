# Meant to be called with the context being the parent directory of
# `docker/`, i.e. the root of this git repo.

FROM registry.gitlab.steamos.cloud/steamrt/scout/sdk

COPY . /home/devroot

ENV NVM_DIR /home/devroot/.nvm
ENV NODE_VERSION v10.24.1

WORKDIR /home/devroot
RUN ./scripts/install_nvm.sh \
  && . $NVM_DIR/nvm.sh \
  && nvm install $NODE_VERSION

ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH
