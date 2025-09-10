FROM debian:stable-slim
ENV DEBIAN_FRONTEND noninteractive

RUN echo "deb http://deb.debian.org/debian stable main" > /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian stable-updates main" >> /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian-security stable-security main" >> /etc/apt/sources.list
RUN apt-get update
RUN apt-get install -qyf \
    curl jq make git \
    python3-pygments gnuplot \
    texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended \
    texlive-luatex texlive-fonts-extra fonts-liberation fonts-dejavu-core
RUN rm -rf /var/lib/apt/lists/*

# Update the font cache for LuaTeX
RUN luaotfload-tool --update

WORKDIR /data
VOLUME ["/data"]
