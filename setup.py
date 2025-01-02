# setup.py
from setuptools import setup

setup(
    name="problem_cutter",
    version="1.0.0",
    packages=["problem_cutter"],
    install_requires=[
        "PyMuPDF==1.23.8",  # fitz
        "Pillow==10.2.0",   # PIL
        "numpy==1.26.3",
        "python-dotenv==1.0.0"
    ]
)