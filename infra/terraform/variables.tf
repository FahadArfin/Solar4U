variable "project_id" { type = string }
variable "region" { type = string; default = "us-east4" }
variable "environment" { type = string; default = "staging" }
variable "domain" { type = string; default = "" }
variable "database_tier" { type = string; default = "db-f1-micro" }
