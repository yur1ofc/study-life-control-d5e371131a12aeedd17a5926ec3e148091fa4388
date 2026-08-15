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
          && (!('extraCourses' in d) || d.extraCourses.size() <= 200);
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

    // ─── Proteção padrão: nega tudo que não foi explicitamente permitido ──────
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
