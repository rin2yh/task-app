terraform {
  required_version = ">= 1.9.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }

  # Cloudflare R2 (S3 互換) backend。
  # bucket と endpoints は環境固有なので `terraform init -backend-config=...` で注入する。
  # ローカルからの初回移行手順は docs/cicd.md セクション 2.4 を参照。
  backend "s3" {
    key    = "terraform.tfstate"
    region = "auto"

    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
