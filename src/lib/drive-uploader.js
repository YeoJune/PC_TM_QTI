// src/lib/drive-uploader.js
const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const { authenticate } = require("@google-cloud/local-auth");

class DriveUploader {
  constructor(
    credentialsPath = "./credentials.json",
    tokenPath = "./token.json",
    rootFolderId = null,
  ) {
    this.credentialsPath = credentialsPath;
    this.tokenPath = tokenPath;
    this.rootFolderId = rootFolderId;
    this.drive = null;
    this.SCOPES = ["https://www.googleapis.com/auth/drive.file"];
  }

  async initialize() {
    try {
      // 기존 토큰 로드 시도
      const token = await this._loadToken();
      if (token) {
        const auth = await this._createAuthFromToken(token);
        this.drive = google.drive({ version: "v3", auth });
        return;
      }
    } catch (error) {
      console.log("No valid token found, need to authenticate");
    }

    // 새로운 인증 진행
    const auth = await authenticate({
      scopes: this.SCOPES,
      keyfilePath: this.credentialsPath,
    });

    // 토큰 저장
    await this._saveToken(auth.credentials);
    this.drive = google.drive({ version: "v3", auth });
  }

  async _loadToken() {
    try {
      const content = await fs.readFile(this.tokenPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async _saveToken(credentials) {
    await fs.writeFile(this.tokenPath, JSON.stringify(credentials, null, 2));
  }

  async _createAuthFromToken(token) {
    const credentials = JSON.parse(
      await fs.readFile(this.credentialsPath, "utf8"),
    );
    const { client_secret, client_id, redirect_uris } =
      credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );

    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  async uploadImage(filePath, folderId = null) {
    if (!this.drive) {
      throw new Error("Drive not initialized. Call initialize() first.");
    }

    const fileName = path.basename(filePath);
    const targetFolderId = folderId || this.rootFolderId;
    const fileMetadata = {
      name: fileName,
      parents: targetFolderId ? [targetFolderId] : [],
    };

    const media = {
      mimeType: "image/png",
      body: require("fs").createReadStream(filePath),
    };

    try {
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, webViewLink, webContentLink",
      });

      // 파일 공유 설정 (누구나 볼 수 있게)
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      return response.data.id;
    } catch (error) {
      throw new Error(`Failed to upload ${fileName}: ${error.message}`);
    }
  }

  async uploadImageWithName(filePath, customName, folderId = null) {
    if (!this.drive) {
      throw new Error("Drive not initialized. Call initialize() first.");
    }

    const targetFolderId = folderId || this.rootFolderId;
    const fileMetadata = {
      name: customName,
      parents: targetFolderId ? [targetFolderId] : [],
    };

    const media = {
      mimeType: "image/png",
      body: require("fs").createReadStream(filePath),
    };

    try {
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, webViewLink, webContentLink",
      });

      // 파일 공유 설정 (누구나 볼 수 있게)
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      return response.data.id;
    } catch (error) {
      throw new Error(`Failed to upload ${customName}: ${error.message}`);
    }
  }

  async uploadImages(imagePaths, folderId = null) {
    const fileIds = new Map();

    for (const imagePath of imagePaths) {
      const fileId = await this.uploadImage(imagePath, folderId);
      fileIds.set(path.basename(imagePath), fileId);
    }

    return fileIds;
  }

  async createFolder(folderName, parentFolderId = null) {
    if (!this.drive) {
      throw new Error("Drive not initialized. Call initialize() first.");
    }

    const targetParentId = parentFolderId || this.rootFolderId;
    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: targetParentId ? [targetParentId] : [],
    };

    try {
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: "id",
      });

      return response.data.id;
    } catch (error) {
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }

  getThumbnailUrl(fileId, size = 800) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
  }
}

module.exports = { DriveUploader };
