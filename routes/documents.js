const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const verifyToken = require("../middleware/verifyToken");

// Improved MIME type mapping
const MIME_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

// Configure multer for file uploads with improved error handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and add timestamp
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(sanitizedName);
    cb(
      null,
      `${path.basename(sanitizedName, extension)}-${uniqueSuffix}${extension}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase().substring(1);
  const mimeType = MIME_TYPES[extension];

  if (!mimeType) {
    return cb(
      new Error(
        "Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG are allowed."
      ),
      false
    );
  }

  if (file.mimetype !== mimeType) {
    return cb(new Error("File content does not match its extension."), false);
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only allow 1 file per upload
  },
  fileFilter: fileFilter,
}).single("document");

// Enhanced upload error handling middleware
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "File size too large. Maximum size is 10MB." });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }
  next();
};

// Upload a document (admin only)
router.post("/upload", verifyToken, isAdmin, handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { title, description, documentType, targetAudience } = req.body;
    const filePath = `uploads/${req.file.filename}`;
    const fileType = path.extname(req.file.originalname).substring(1);

    // Verify file exists and is readable
    try {
      await fs.promises.access(
        path.join(__dirname, "..", filePath),
        fs.constants.R_OK
      );
    } catch (error) {
      return res
        .status(500)
        .json({ message: "File upload failed - file not accessible" });
    }

    const query = `
        INSERT INTO documents 
        (title, description, file_path, file_type, document_type, target_audience, uploaded_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

    db.query(
      query,
      [
        title,
        description,
        filePath,
        fileType,
        documentType,
        targetAudience,
        req.user.id,
      ],
      (err, result) => {
        if (err) {
          // Clean up uploaded file if database insert fails
          fs.unlink(path.join(__dirname, "..", filePath), () => {});
          console.error("Error uploading document:", err);
          return res.status(500).json({ message: "Failed to upload document" });
        }

        res.status(201).json({
          message: "Document uploaded successfully",
          documentId: result.insertId,
        });
      }
    );
  } catch (error) {
    console.error("Error in document upload:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get documents based on user role and target audience
router.get("/", verifyToken, (req, res) => {
  let query = `
    SELECT d.*, u.email as uploader_email 
    FROM documents d
    JOIN users u ON d.uploaded_by = u.id
    WHERE 1=1
  `;

  const params = [];

  // Filter by role (admin sees all, teachers and students see only their relevant documents)
  if (req.user.role !== "admin") {
    query += ` AND (d.target_audience = ? OR d.target_audience = 'both')`;
    params.push(req.user.role);
  }

  // Optional document type filter
  if (req.query.type) {
    query += ` AND d.document_type = ?`;
    params.push(req.query.type);
  }

  query += ` ORDER BY d.upload_date DESC`;

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Error fetching documents:", err);
      return res.status(500).json({ message: "Failed to fetch documents" });
    }

    res.status(200).json(results);
  });
});

// Get a specific document
router.get("/:id", verifyToken, (req, res) => {
  const documentId = req.params.id;

  const query = `
    SELECT d.*, u.email as uploader_email 
    FROM documents d
    JOIN users u ON d.uploaded_by = u.id
    WHERE d.id = ?
  `;

  db.query(query, [documentId], (err, results) => {
    if (err) {
      console.error("Error fetching document:", err);
      return res.status(500).json({ message: "Failed to fetch document" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const document = results[0];

    // Check if user has access to this document
    if (
      req.user.role !== "admin" &&
      document.target_audience !== req.user.role &&
      document.target_audience !== "both"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json(document);
  });
});

// Delete a document (admin only)
router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  const documentId = req.params.id;

  // First get the document to find the file path
  db.query(
    "SELECT file_path FROM documents WHERE id = ?",
    [documentId],
    (err, results) => {
      if (err) {
        console.error("Error finding document:", err);
        return res.status(500).json({ message: "Failed to delete document" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "Document not found" });
      }

      const filePath = path.join(__dirname, "..", results[0].file_path);

      // Delete from database
      db.query(
        "DELETE FROM documents WHERE id = ?",
        [documentId],
        (err, result) => {
          if (err) {
            console.error("Error deleting document from database:", err);
            return res
              .status(500)
              .json({ message: "Failed to delete document" });
          }

          // Try to delete the file (but don't fail if file is missing)
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error("Error deleting file:", error);
            // Continue anyway since the database record is deleted
          }

          res.status(200).json({ message: "Document deleted successfully" });
        }
      );
    }
  );
});

// Download a document
router.get("/download/:id", verifyToken, async (req, res) => {
  const documentId = req.params.id;

  try {
    const [document] = await new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM documents WHERE id = ?",
        [documentId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check access permissions
    if (
      req.user.role !== "admin" &&
      document.target_audience !== req.user.role &&
      document.target_audience !== "both"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const filePath = path.join(__dirname, "..", document.file_path);

    // Check if file exists and is accessible
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (error) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Get file stats
    const stats = await fs.promises.stat(filePath);
    if (stats.size === 0) {
      return res.status(400).json({ message: "File is empty" });
    }

    // Determine content type
    const ext = path.extname(document.file_path).toLowerCase().substring(1);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Set response headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stats.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(document.title + "." + ext)}"`
    );
    res.setHeader("Cache-Control", "no-cache");

    // Stream the file with error handling
    const fileStream = fs.createReadStream(filePath);

    fileStream.on("error", (error) => {
      console.error("Error streaming file:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error streaming file" });
      }
    });

    fileStream.pipe(res);

    // Handle client disconnect
    res.on("close", () => {
      fileStream.destroy();
    });
  } catch (error) {
    console.error("Error in document download:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Server error" });
    }
  }
});

// View a document (similar to download but opens in browser)
router.get("/view/:id", verifyToken, (req, res) => {
  const documentId = req.params.id;

  const query = `
    SELECT * FROM documents WHERE id = ?
  `;

  db.query(query, [documentId], (err, results) => {
    if (err) {
      console.error("Error fetching document for viewing:", err);
      return res.status(500).json({ message: "Failed to view document" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const document = results[0];

    // Check if user has access to this document
    if (
      req.user.role !== "admin" &&
      document.target_audience !== req.user.role &&
      document.target_audience !== "both"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const filePath = path.join(__dirname, "..", document.file_path);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Determine content type based on file extension
    const ext = path.extname(document.file_path).toLowerCase();
    let contentType = "application/octet-stream";

    if (ext === ".pdf") contentType = "application/pdf";
    else if (ext === ".doc") contentType = "application/msword";
    else if (ext === ".docx")
      contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (ext === ".xls") contentType = "application/vnd.ms-excel";
    else if (ext === ".xlsx")
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";

    // Set appropriate headers for viewing in browser
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(document.file_path)}"`
    );

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Handle errors in the stream
    fileStream.on("error", (error) => {
      console.error("Error streaming file:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error streaming file" });
      }
    });
  });
});

module.exports = router;
