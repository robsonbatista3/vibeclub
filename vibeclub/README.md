# VibeClub - Rede Social Adulta 18+

Plataforma completa com lives, monetização por moedas virtuais e pagamentos via PIX.

## 🚀 Tecnologias
- **Frontend:** React, TailwindCSS, Framer Motion, Lucide Icons
- **Backend:** Node.js, Express, Firebase (Firestore/Auth)
- **Pagamentos:** Sistema de moedas virtuais (PIX manual ou outros métodos)

## ⚙️ Configuração Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente no arquivo `.env`:
   - `GEMINI_API_KEY`: Chave da API Gemini (opcional para IA)
   - `APP_URL`: URL da sua aplicação

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## 📦 Deploy

### Frontend
O frontend pode ser buildado com `npm run build` e os arquivos na pasta `dist` podem ser servidos por qualquer host estático.

### Backend
O servidor Express (`server.ts`) deve ser executado em um ambiente Node.js.

## 💰 Sistema de Moedas
A plataforma utiliza um sistema de moedas virtuais armazenado no Firestore. O saldo é atualizado conforme o usuário gasta em lives ou presentes.
