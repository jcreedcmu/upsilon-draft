# Meant to be called with the context being the parent directory of
# `docker/`, i.e. the root of this git repo.

FROM registry.gitlab.steamos.cloud/steamrt/soldier/sdk

COPY . /home/devroot

ENV NVM_DIR /home/devroot/.nvm
ENV NODE_VERSION v18.11.0

WORKDIR /home/devroot
RUN ./scripts/install_nvm.sh \
  && . $NVM_DIR/nvm.sh \
  && nvm install $NODE_VERSION

ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH

RUN cd native-layer && npm i
RUN cd sdl-game && npm i

RUN groupadd -g 1000 x11user
RUN useradd -d /home/x11user -s /bin/bash -m x11user -u 1000 -g 1000
USER x11user
ENV HOME /home/x11user

CMD node sdl-game/index.js