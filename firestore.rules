rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Funções auxiliares ─────────────────────────────────────────────────

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Limite de tamanho para campos de texto livres (previne abusos de storage)
    function strLen(field, max) {
      return field is string && field.size() <= max;
    }

    // Validação de schema do catálogo comunitário
    function validCatalogSchema(docId) {
      let d = request.resource.data;
      return d.key == docId
        && strLen(d.faculdade, 120)
        && strLen(d.curso, 120)
        && d.subjects is list
        && d.subjects.size() <= 200          // máx 200 matérias por catálogo
        && strLen(d.updatedAt, 30);
    }

    // Validação de tamanho do documento do usuário (máx ~2 MB serializado)
    // O Firestore tem limite de 1 MB por documento; essa regra impede payloads
    // malformados antes mesmo de chegar ao servidor.
    function validUserDocSize() {
      // Limita arrays principais para evitar crescimento ilimitado
      let d = request.resource.data;
      return (!('sessions'   in d) || d.sessions.size()   <= 5000)
          && (!('tasks'      in d) || d.tasks.size()      <= 2000)
          && (!('exams'      in d) || d.exams.size()      <= 500)
          && (!('materials'  in d) || d.materials.size()  <= 2000)
          && (!('grades'     in d) || d.grades.size()     <= 2000)
          && (!('dailyLogs'  in d) || d.dailyLogs.size()  <= 3650)  // ~10 anos
          && (!('classDiaries' in d) || d.classDiaries.size() <= 5000)
          && (!('curriculum' in d) || d.curriculum.size() <= 500)
          && (!('extraCourses' in d) || d.extraCourses.size() <= 200)
          && (!('pushSubscriptions' in d) || d.pushSubscriptions.size() <= 10)
          && (!('sentReminders' in d) || d.sentReminders.size() <= 500);
    }

    // ─── Dados do usuário ────────────────────────────────────────────────────

    match /users/{userId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && validUserDocSize();
    }

    match /users/{userId}/{document=**} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId);
    }

    // ─── Catálogo comunitário ────────────────────────────────────────────────

    match /community_catalogs/{docId} {
      allow read: if isSignedIn();

      allow create: if isSignedIn()
        && validCatalogSchema(docId)
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.updatedBy == request.auth.uid;

      allow update: if isSignedIn()
        && validCatalogSchema(docId)
        && resource.data.key == docId
        && request.resource.data.key == resource.data.key
        && request.resource.data.createdBy == resource.data.createdBy
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedBy == request.auth.uid;

      allow delete: if false;
    }

    match /community_catalogs/{docId}/{document=**} {
      allow read: if isSignedIn();
      allow write, delete: if false;
    }

    // ─── Submissions comunitárias ─────────────────────────────────────────────

    match /community_catalog_submissions/{docId} {
      allow read: if isSignedIn();

      allow create: if isSignedIn()
        && request.resource.data.sourceUserId == request.auth.uid
        && strLen(request.resource.data.faculdade, 120)
        && strLen(request.resource.data.curso, 120)
        && request.resource.data.subjects is list
        && request.resource.data.subjects.size() <= 200
        && strLen(request.resource.data.submittedAt, 30);

      allow update, delete: if false;
    }

    // ─── Contador de uso da importação de grade por IA ────────────────────────
    // Um documento por usuário só com "date" e "count" — usado pelo
    // api/gemini.js para limitar quantas importações cada um faz por dia.

    match /ai_usage/{userId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId)
        && strLen(request.resource.data.date, 10)
        && request.resource.data.count is int
        && request.resource.data.count >= 0
        && request.resource.data.count <= 1000;
    }

    // ─── Contador de uso do chat do Mentor IA ─────────────────────────────────
    // Igual ao ai_usage acima, mas em coleção própria — usada pelo
    // api/mentor-chat.js para limitar quantas mensagens de chat cada um manda
    // por dia, sem disputar cota com a importação de grade (ai_usage).

    match /mentor_usage/{userId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId)
        && strLen(request.resource.data.date, 10)
        && request.resource.data.count is int
        && request.resource.data.count >= 0
        && request.resource.data.count <= 2000;
    }

    // ─── Contador GLOBAL de uso do Gemini (import de grade + chat, somados) ───
    // Documento único ("counter"), usado por api/gemini.js E api/mentor-chat.js
    // (via api/_lib/gemini-shared-quota.js) pra saber quantas chamadas ao
    // Gemini o SITE INTEIRO já fez hoje — a chave de API é uma só,
    // compartilhada por todos, então o limite por usuário sozinho não
    // protege a cota do projeto. O import de grade tem prioridade sobre o
    // chat dentro desse total (ver GEMINI_IMPORT_RESERVE no código). Qualquer
    // usuário logado pode incrementar (é um contador agregado, sem dado
    // pessoal), mas só em +1 por vez e dentro de um teto alto de segurança.
    // Best-effort: não é uma trava perfeitamente atômica contra concorrência,
    // só suficiente para evitar estourar a cota grátis por uma margem grande.

    match /gemini_usage_global/counter {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && strLen(request.resource.data.date, 10)
        && request.resource.data.count is int
        && request.resource.data.count >= 0
        && request.resource.data.count <= 100000;
    }

    // ─── Feed de calendário assinável (.ics) ───────────────────────────────────
    // Cada usuário publica uma "foto" pública (mas sem nome nem e-mail) das
    // provas/tarefas/sessões/aulas nesse documento, identificado por um token
    // aleatório e longo (gerado em calendar-feed.js). Leitura é pública de
    // propósito: é assim que app de calendário (Google/Apple/Outlook) consegue
    // buscar o .ics periodicamente sem o usuário precisar logar de novo — a
    // segurança vem do token ser longo o bastante pra não dar pra adivinhar,
    // igual um link "de compartilhamento" de qualquer outro serviço. Só quem
    // tem a URL consegue ler; ninguém consegue *listar* os tokens existentes.
    match /calendar_feeds/{token} {
      allow read: if true;

      allow create: if isSignedIn()
        && token.size() >= 24 && token.size() <= 64
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.exams is list && request.resource.data.exams.size() <= 500
        && request.resource.data.tasks is list && request.resource.data.tasks.size() <= 2000
        && request.resource.data.sessions is list && request.resource.data.sessions.size() <= 500
        && request.resource.data.classSchedule is list && request.resource.data.classSchedule.size() <= 200;

      allow update: if isSignedIn()
        && resource.data.uid == request.auth.uid
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.exams is list && request.resource.data.exams.size() <= 500
        && request.resource.data.tasks is list && request.resource.data.tasks.size() <= 2000
        && request.resource.data.sessions is list && request.resource.data.sessions.size() <= 500
        && request.resource.data.classSchedule is list && request.resource.data.classSchedule.size() <= 200;

      // Apagar o token revoga a URL antiga (usado ao "gerar novo link").
      allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
    }

    // ─── Feedback in-app (feedback-widget.js) ─────────────────────────────────
    // Qualquer usuário logado pode criar um feedback próprio. Ninguém lê,
    // edita ou apaga pelo app — só você, direto no Console do Firebase.

    match /feedback/{docId} {
      allow read, update, delete: if false;
      allow create: if isSignedIn()
        && request.resource.data.uid == request.auth.uid
        && strLen(request.resource.data.mensagem, 2000)
        && request.resource.data.tipo in ['bug', 'sugestao', 'elogio'];
    }

    // ─── Proteção padrão: nega tudo que não foi explicitamente permitido ──────
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
