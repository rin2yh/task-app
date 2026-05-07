terraform {
  required_version = ">= 1.9.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }

  # 当面ローカル backend。安定後に R2 backend へ移行する。
  backend "local" {
    path = "terraform.tfstate"
  }
}
