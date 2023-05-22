# Oracle for Uniswap Mock

## Build

```shell
cd <marginly_root_dir>
docker build -f packages/oracle/Dockerfile .
```

## Run

```shell
docker run -e MARGINLY_ORACLE_ETHEREUM_ORACLE_PRIVATE_KEY=<oracle_private_key> <docker_image_hash>
```

You can set log format by defining environment variable:

```shell
MARGINLY_ORACLE_LOG_FORMAT=json
```

Supported formats are `text` and `json`.