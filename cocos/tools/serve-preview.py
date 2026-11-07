"""本地预览使用HTTP/1.1持久连接，减少大量素材请求反复创建TCP连接。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

class PreviewHandler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=42828)
    parser.add_argument('--bind',default='127.0.0.1')
    parser.add_argument('--directory',default='.')
    args=parser.parse_args()
    directory=Path(args.directory).resolve(strict=True)
    handler=partial(PreviewHandler,directory=str(directory))
    with ThreadingHTTPServer((args.bind,args.port),handler) as server:
        print(f'Preview: http://{args.bind}:{args.port}/',flush=True)
        server.serve_forever()
