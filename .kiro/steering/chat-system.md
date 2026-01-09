# Système de Chat Simplifié (WhatsApp-like)

## Vue d'ensemble

Le système de chat fonctionne maintenant comme WhatsApp ou SMS - simple, direct et intuitif.

## Endpoints

### 1. Créer une conversation et envoyer un message

**Endpoint**: `POST /api/v1/chat/messages`

**Body**:
```json
{
  "recipients": ["userId1", "userId2"],  // Array pour groupe ou single
  "message": "Bonjour!",
  "subject": "Titre optionnel"
}
```

**Réponse**:
```json
{
  "success": true,
  "message": "Conversation créée avec succès",
  "data": {
    "conversation": {
      "_id": "convId",
      "type": "direct",
      "title": "Nom Prénom - Autre Nom",
      "participants": [...],
      "createdAt": "2026-01-08T..."
    },
    "firstMessage": {
      "_id": "msgId",
      "content": "Bonjour!",
      "sender": {...},
      "createdAt": "2026-01-08T..."
    }
  }
}
```

### 2. Récupérer les conversations

**Endpoint**: `GET /api/v1/chat/conversations?page=1&limit=20`

**Réponse**:
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "_id": "convId",
        "type": "direct",
        "title": "Nom Prénom",
        "participants": [...],
        "unreadCount": 3,
        "lastActivityAt": "2026-01-08T...",
        "lastMessage": {
          "content": "Dernier message...",
          "sender": {...},
          "createdAt": "2026-01-08T..."
        }
      }
    ],
    "total": 5,
    "page": 1,
    "pages": 1
  }
}
```

### 3. Récupérer les messages d'une conversation

**Endpoint**: `GET /api/v1/chat/:conversationId/messages?limit=50&before=2026-01-08T...`

**Réponse**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "msgId",
      "content": "Bonjour!",
      "sender": {
        "_id": "userId",
        "nom": "Dupont",
        "prenom": "Jean",
        "avatar": "url",
        "role": "conseiller"
      },
      "createdAt": "2026-01-08T10:30:00Z"
    }
  ]
}
```

### 4. Envoyer un message dans une conversation existante

**Endpoint**: `POST /api/v1/chat/:conversationId/messages`

**Body**:
```json
{
  "content": "Réponse au message",
  "attachments": []
}
```

**Réponse**:
```json
{
  "success": true,
  "message": "Message envoyé",
  "data": {
    "_id": "msgId",
    "content": "Réponse au message",
    "sender": {...},
    "createdAt": "2026-01-08T..."
  }
}
```

### 5. Marquer comme lu

**Endpoint**: `PATCH /api/v1/chat/:conversationId/read`

**Réponse**:
```json
{
  "success": true,
  "message": "Conversation marquée comme lue"
}
```

### 6. Récupérer les membres disponibles

**Endpoint**: `GET /api/v1/chat/team`

**Réponse**:
```json
{
  "success": true,
  "data": [
    {
      "id": "userId",
      "nom": "Dupont",
      "prenom": "Jean",
      "email": "jean@example.com",
      "role": "conseiller",
      "roleLabel": "Conseiller Clientèle",
      "avatar": "url",
      "telephone": "06...",
      "isAvailable": true
    }
  ]
}
```

## Flux d'utilisation

### Démarrer une conversation

1. Récupérer la liste des membres: `GET /api/v1/chat/team`
2. Créer une conversation et envoyer le premier message: `POST /api/v1/chat/messages`
3. Récupérer les messages: `GET /api/v1/chat/:conversationId/messages`

### Envoyer un message

1. `POST /api/v1/chat/:conversationId/messages` avec le contenu
2. Le message est envoyé et notifié aux autres participants via Socket.IO

### Charger l'historique

1. `GET /api/v1/chat/:conversationId/messages?limit=50`
2. Pour charger plus ancien: `GET /api/v1/chat/:conversationId/messages?limit=50&before=2026-01-08T10:00:00Z`

## Caractéristiques

✅ **Simple**: Pas de complexité inutile
✅ **Temps réel**: Notifications via Socket.IO
✅ **Pagination**: Chargement des anciens messages
✅ **Marquage comme lu**: Suivi des messages non lus
✅ **Groupes**: Support des conversations de groupe
✅ **Directs**: Conversations 1-on-1
✅ **Demandes**: Conversations liées aux demandes de forçage

## Types de conversations

- `direct`: Conversation 1-on-1
- `group`: Conversation de groupe
- `demande`: Conversation liée à une demande
- `support`: Conversation de support

## Statuts des messages

- `text`: Message texte simple
- `file`: Message avec fichier
- `system`: Message système (notifications)

## Notes

- Les messages sont marqués comme lus automatiquement lors de la récupération
- Les notifications non lues sont comptabilisées par utilisateur
- Les conversations sont triées par activité récente
- Les participants peuvent être ajoutés/retirés dynamiquement
