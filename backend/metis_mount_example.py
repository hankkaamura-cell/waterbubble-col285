"""
MANUAL EXAMPLE ONLY. DO NOT COPY INTO main.py WITHOUT PROJECT OWNER APPROVAL.

This file is included only so Kanaan can see the intended mount shape after a new
branch is created and Skye explicitly approves integration.
"""

from fastapi import FastAPI

from .metis_location_sharing import register_metis_location_sharing

app = FastAPI()

# Manual integration shape:
# register_metis_location_sharing(app, start_background_reconciler=True)
