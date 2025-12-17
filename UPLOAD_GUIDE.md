Guide d'Upload de Fichiers lors de la Création de Demande

 Endpoint

POST /api/v1/demandes

 Configuration
- Nombre max de fichiers: 5 fichiers
- Taille max par fichier: 5 MB
- Formats acceptés: JPEG, JPG, PNG, PDF, DOC, DOCX, XLS, XLSX

 Utilisation avec Postman

 1. Configuration de la requête
- Method: POST
- URL: `{{base_url}}/api/v1/demandes`
- Authorization: Bearer Token

 2. Body (form-data)
Sélectionnez form-data dans l'onglet Body et ajoutez:

| Key | Type | Value |
|-----|------|-------|
| motif | Text | "Besoin urgent de déblocage pour paiement fournisseur" |
| montant | Text | 2500000 |
| typeOperation | Text | "VIREMENT" |
| piecesJustificatives | File | [Sélectionner fichier 1] |
| piecesJustificatives | File | [Sélectionner fichier 2] |
| piecesJustificatives | File | [Sélectionner fichier 3] |

Important: Pour ajouter plusieurs fichiers, utilisez le même nom de champ `piecesJustificatives` plusieurs fois.

 3. Exemple de réponse
json
{
  "success": true,
  "message": "Demande créée avec succès",
  "data": {
    "demande": {
      "id": "674abc123def456789",
      "numeroReference": "DF202412001",
      "statut": "BROUILLON",
      "montant": 2500000,
      "typeOperation": "VIREMENT",
      "scoreRisque": "MOYEN",
      "dateEcheance": "2024-12-30T12:00:00.000Z",
      "piecesJustificatives": [
        {
          "nom": "facture.pdf",
          "url": "/uploads/piecesJustificatives-1702645123456-123456789.pdf",
          "type": "application/pdf",
          "taille": 245678,
          "uploadedAt": "2024-12-15T12:00:00.000Z"
        },
        {
          "nom": "contrat.pdf",
          "url": "/uploads/piecesJustificatives-1702645123457-987654321.pdf",
          "type": "application/pdf",
          "taille": 189234,
          "uploadedAt": "2024-12-15T12:00:00.000Z"
        }
      ],
      "createdAt": "2024-12-15T12:00:00.000Z"
    }
  }
}


 Utilisation avec cURL

curl -X POST http://localhost:3000/api/v1/demandes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "motif=Besoin urgent de déblocage" \
  -F "montant=2500000" \
  -F "typeOperation=VIREMENT" \
  -F "piecesJustificatives=@/path/to/facture.pdf" \
  -F "piecesJustificatives=@/path/to/contrat.pdf"


 Utilisation avec JavaScript (Fetch API)

javascript
const formData = new FormData();
formData.append('motif', 'Besoin urgent de déblocage');
formData.append('montant', '2500000');
formData.append('typeOperation', 'VIREMENT');

// Ajouter plusieurs fichiers
const file1 = document.getElementById('file1').files[0];
const file2 = document.getElementById('file2').files[0];
formData.append('piecesJustificatives', file1);
formData.append('piecesJustificatives', file2);

fetch('http://localhost:3000/api/v1/demandes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Erreur:', error));


 Gestion des Erreurs

 Fichier trop volumineux
json
{
  "success": false,
  "message": "File too large"
}


 Type de fichier non autorisé
json
{
  "success": false,
  "message": "Type de fichier non autorisé. Formats acceptés: JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX"
}


 Trop de fichiers
json
{
  "success": false,
  "message": "Too many files"
}


 Notes
- Les fichiers sont stockés dans le dossier `uploads/` du serveur
- Les noms de fichiers sont automatiquement renommés pour éviter les conflits
- Format du nom: `piecesJustificatives-{timestamp}-{random}.{extension}`
- Les fichiers peuvent être téléchargés via l'URL retournée dans la réponse
