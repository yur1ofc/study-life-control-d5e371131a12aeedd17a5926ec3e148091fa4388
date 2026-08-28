Baixe estes 4 arquivos e coloque NESTA PASTA (vendor/firebase/), mantendo exatamente estes nomes:

https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js
https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js
https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js
https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics-compat.js

Como baixar (escolha uma opção):

OPÇÃO 1 - pelo navegador:
Abra cada link acima, aperte Ctrl+S (ou Cmd+S no Mac) e salve com o mesmo nome do arquivo, dentro desta pasta.

OPÇÃO 2 - pelo terminal (se tiver curl):
curl -o firebase-app-compat.js https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js
curl -o firebase-auth-compat.js https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js
curl -o firebase-firestore-compat.js https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js
curl -o firebase-analytics-compat.js https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics-compat.js

Depois disso é só reempacotar o projeto e fazer o deploy no Vercel normalmente.
