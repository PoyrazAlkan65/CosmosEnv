# CosmosEnv 🌌

**Platformlar arası container ortam değişkeni (env) ve secret yöneticisi.**

CosmosEnv, Docker, Podman, Kubernetes ve benzeri container platformlarında çalışan uygulamalar için ortam değişkenlerini (env) ve gizli anahtarları (secret) taşımayı, dönüştürmeyi ve senkronize etmeyi kolaylaştırır.

## 🚀 Özellikler

- Platformdan bağımsız `env` ve `secret` yönetimi
- Docker → Kubernetes → Podman geçişinde otomatik dönüşüm
- Web tabanlı kullanıcı arayüzü
- Proje ve ortam profili desteği (dev/stage/prod)
- Audit log ve versiyonlama

## 📦 Planlanan Destekler

- [ ] Docker
- [ ] Kubernetes
- [ ] Podman
- [ ] HashiCorp Vault
- [ ] GitOps entegrasyonu

## 📂 Yapı

- `frontend/`: Web UI
- `backend/`: API ve işlem motoru
- `adapters/`: Platform bağımsız çeviriciler
- `core/`: Ortak çekirdek servisler

