import os
import boto3

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

bedrock_client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
