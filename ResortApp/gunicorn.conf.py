# Gunicorn configuration file for Stayone Resort Management System
# Containerized production deployment

import os
import multiprocessing

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8011')}"
backlog = 2048

# Worker processes
workers = int(os.getenv("WEB_CONCURRENCY", "3"))
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
preload_app = False
timeout = 120  # Increased timeout for slower operations
graceful_timeout = 30  # Graceful shutdown timeout
keepalive = 5  # Increased keepalive for better connection reuse

# Logging - stdout/stderr for Docker log capture
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "stayone_backend"

# Server mechanics
daemon = False
pidfile = None  # Let container manager manage PID
tmp_upload_dir = None

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Application
current_dir = os.path.dirname(os.path.abspath(__file__))
pythonpath = current_dir
chdir = current_dir

# Performance
worker_tmp_dir = "/dev/shm"


def when_ready(server):
    """Called just after the server is started."""
    server.log.info("Stayone Resort Management System is ready to serve requests")


def worker_int(worker):
    """Called when a worker receives the SIGINT or SIGQUIT signal."""
    worker.log.info("Worker received SIGINT or SIGQUIT")


def pre_fork(server, worker):
    """Called just before a worker is forked."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forked child, re-executing.")


def pre_request(worker, req):
    """Called just before a worker processes the request."""
    worker.log.debug("%s %s", req.method, req.path)


def post_request(worker, req, environ, resp):
    """Called after a worker processes the request."""
    worker.log.debug("Response status: %s", resp.status)
