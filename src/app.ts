import express from "express";
import axios from "axios";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import multer from "multer";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Service URLs
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
const PRODUCT_SERVICE =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:8003";
const CART_SERVICE = process.env.CART_SERVICE_URL || "http://localhost:8002";
const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || "http://localhost:8004";
const REVIEW_SERVICE =
  process.env.REVIEW_SERVICE_URL || "http://localhost:8005";

// Create uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);
app.use(morgan("dev"));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Standard request forwarding (for JSON requests)
const forwardRequest = async (
  req: Request,
  res: Response,
  targetService: string,
  targetPath: string
) => {
  try {
    const url = `${targetService}${targetPath}`;
    console.log(`Forwarding ${req.method} request to: ${url}`);

    // For regular requests
    const contentType = req.headers["content-type"] || "";

    // If it's a multipart form, process it differently
    if (contentType.includes("multipart/form-data")) {
      return handleMultipartRequest(req, res, targetService, targetPath);
    }

    console.log(`Request body:`, req.body);

    // Standard request handling
    const requestConfig: any = {
      method: req.method,
      url: url,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        ...(req.headers.authorization && {
          Authorization: req.headers.authorization,
        }),
      },
      validateStatus: () => true,
    };

    if (req.method !== "GET") {
      requestConfig.data = req.body;
    }

    const response = await axios(requestConfig);
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error(`Error forwarding request to ${targetService}:`, error);

    if (error.response) {
      console.log(`Service responded with status ${error.response.status}`);
      console.log("Error response data:", error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }

    if (error.code === "ECONNREFUSED") {
      console.error(`Service connection refused: ${targetService}`);
      return res.status(503).json({
        error: "Service Unavailable",
        message:
          "Could not connect to service. Please ensure the service is running.",
      });
    }

    return res.status(500).json({
      error: "Gateway Error",
      message: error.message || "Unknown error occurred",
    });
  }
};

// Handle multipart form data
// const handleMultipartRequest = (
//   req: Request,
//   res: Response,
//   targetService: string,
//   targetPath: string
// ) => {
//   const multerMiddleware = upload.any();

//   multerMiddleware(req, res, async (err) => {
//     if (err) {
//       console.error("Multer error:", err);
//       return res
//         .status(500)
//         .json({ error: "File upload error", message: err.message });
//     }

//     try {
//       const url = `${targetService}${targetPath}`;
//       console.log("Forwarding multipart request to:", url);
//       console.log("Form data fields:", req.body);
//       console.log("Files:", req.files);

//       const formData = new FormData();

//       // Add form fields
//       if (req.body) {
//         Object.keys(req.body).forEach((key) => {
//           formData.append(key, req.body[key]);
//         });
//       }

//       // Add files
//       if (Array.isArray(req.files)) {
//         req.files.forEach((file) => {
//           formData.append(file.fieldname, fs.createReadStream(file.path), {
//             filename: file.originalname,
//             contentType: file.mimetype,
//           });
//         });
//       }

//       // Send the request with axios
//       const response = await axios({
//         method: req.method,
//         url: url,
//         data: formData,
//         headers: {
//           ...formData.getHeaders(),
//           ...(req.headers.authorization && {
//             Authorization: req.headers.authorization,
//           }),
//         },
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity,
//         validateStatus: () => true,
//       });

//       // Clean up temporary files
//       if (Array.isArray(req.files)) {
//         for (const file of req.files) {
//           try {
//             fs.unlinkSync(file.path);
//           } catch (error) {
//             console.error(`Failed to delete temp file ${file.path}:`, error);
//           }
//         }
//       }

//       return res.status(response.status).json(response.data);
//     } catch (error: any) {
//       console.error("Error in multipart request:", error);

//       // Clean up temporary files
//       if (Array.isArray(req.files)) {
//         for (const file of req.files) {
//           try {
//             fs.unlinkSync(file.path);
//           } catch (error) {
//             console.error(`Failed to delete temp file ${file.path}:`, error);
//           }
//         }
//       }

//       if (error.response) {
//         return res.status(error.response.status).json(error.response.data);
//       }

//       return res.status(500).json({
//         error: "Gateway Error",
//         message: error.message || "Unknown error occurred",
//       });
//     }
//   });
// };
// Modified handleMultipartRequest function
// const handleMultipartRequest = (
//   req: Request,
//   res: Response,
//   targetService: string,
//   targetPath: string
// ) => {
//   const multerMiddleware = upload.any();

//   multerMiddleware(req, res, async (err) => {
//     if (err) {
//       console.error("Multer error:", err);
//       return res
//         .status(500)
//         .json({ error: "File upload error", message: err.message });
//     }

//     try {
//       const url = `${targetService}${targetPath}`;
//       console.log("Forwarding multipart request to:", url);
//       console.log("Form data fields:", req.body);
//       console.log("Files:", req.files);

//       const formData = new FormData();

//       // Add form fields (handling nested objects)
//       // More compatible handling of nested objects in multipart requests
//       // if (req.body) {
//       //   Object.keys(req.body).forEach((key) => {
//       //     // Special handling for the address field
//       //     if (key === "address" && typeof req.body[key] === "object") {
//       //       // For the address object, append each property individually
//       //       const address = req.body[key];
//       //       Object.keys(address).forEach((subKey) => {
//       //         formData.append(`${key}[${subKey}]`, address[subKey]);
//       //       });
//       //     }
//       //     // Handle other potential nested objects
//       //     else if (
//       //       typeof req.body[key] === "object" &&
//       //       req.body[key] !== null
//       //     ) {
//       //       // Flatten the object into individual fields
//       //       const obj = req.body[key];
//       //       Object.keys(obj).forEach((subKey) => {
//       //         formData.append(`${key}[${subKey}]`, obj[subKey]);
//       //       });
//       //     } else {
//       //       // Handle primitive values normally
//       //       formData.append(key, req.body[key]);
//       //     }
//       //   });
//       // }
//       if (req.body) {
//         Object.keys(req.body).forEach((key) => {
//           // Special handling for numeric fields
//           if (key === "price" || key === "stock") {
//             // Convert string to number
//             formData.append(key, Number(req.body[key]));
//           }
//           // Special handling for subCategory field
//           else if (key === "subCategory") {
//             // Handle as array
//             const subCategoryValue = req.body[key].includes(",")
//               ? req.body[key].split(",").map((item: string) => item.trim())
//               : [req.body[key]];

//             // Append each array element
//             subCategoryValue.forEach((value: string, index: number) => {
//               formData.append(`${key}[${index}]`, value);
//             });
//           }
//           // Special handling for the address field
//           else if (key === "address" && typeof req.body[key] === "object") {
//             // For the address object, append each property individually
//             const address = req.body[key];
//             Object.keys(address).forEach((subKey) => {
//               formData.append(`${key}[${subKey}]`, address[subKey]);
//             });
//           }
//           // Handle other potential nested objects
//           else if (
//             typeof req.body[key] === "object" &&
//             req.body[key] !== null
//           ) {
//             // Flatten the object into individual fields
//             const obj = req.body[key];
//             Object.keys(obj).forEach((subKey) => {
//               formData.append(`${key}[${subKey}]`, obj[subKey]);
//             });
//           } else {
//             // Handle other primitive values normally
//             formData.append(key, req.body[key]);
//           }
//         });
//       }
//       // Add files
//       if (Array.isArray(req.files)) {
//         req.files.forEach((file) => {
//           formData.append(file.fieldname, fs.createReadStream(file.path), {
//             filename: file.originalname,
//             contentType: file.mimetype,
//           });
//         });
//       }

//       // Send the request with axios
//       const response = await axios({
//         method: req.method,
//         url: url,
//         data: formData,
//         headers: {
//           ...formData.getHeaders(),
//           ...(req.headers.authorization && {
//             Authorization: req.headers.authorization,
//           }),
//         },
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity,
//         validateStatus: () => true,
//       });

//       // Clean up temporary files
//       if (Array.isArray(req.files)) {
//         for (const file of req.files) {
//           try {
//             fs.unlinkSync(file.path);
//           } catch (error) {
//             console.error(`Failed to delete temp file ${file.path}:`, error);
//           }
//         }
//       }

//       return res.status(response.status).json(response.data);
//     } catch (error: any) {
//       console.error("Error in multipart request:", error);

//       // Clean up temporary files
//       if (Array.isArray(req.files)) {
//         for (const file of req.files) {
//           try {
//             fs.unlinkSync(file.path);
//           } catch (error) {
//             console.error(`Failed to delete temp file ${file.path}:`, error);
//           }
//         }
//       }

//       if (error.response) {
//         return res.status(error.response.status).json(error.response.data);
//       }

//       return res.status(500).json({
//         error: "Gateway Error",
//         message: error.message || "Unknown error occurred",
//       });
//     }
//   });
// };
const handleMultipartRequest = (
  req: Request,
  res: Response,
  targetService: string,
  targetPath: string
) => {
  const multerMiddleware = upload.any();

  multerMiddleware(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res
        .status(500)
        .json({ error: "File upload error", message: err.message });
    }

    try {
      const url = `${targetService}${targetPath}`;
      console.log("Forwarding multipart request to:", url);
      console.log("Form data fields:", req.body);
      console.log("Files:", req.files);

      // Check if this is a product creation/update request
      const isProductRequest =
        targetPath.includes("/api/v1/products") ||
        targetPath.includes("/api/v1/product");

      // For product endpoints, create properly typed JSON data
      if (isProductRequest && req.body) {
        // Create request body with proper types
        const typedBody: any = {};

        Object.keys(req.body).forEach((key) => {
          if (key === "price" || key === "stock") {
            // Convert to numbers
            typedBody[key] = Number(req.body[key]);
          } else if (key === "subCategory") {
            // Handle as array
            typedBody[key] = req.body[key].includes(",")
              ? req.body[key].split(",").map((item: string) => item.trim())
              : [req.body[key]];
          } else {
            // Keep other fields as they are
            typedBody[key] = req.body[key];
          }
        });

        // If there are files, add a FormData and include both files and typed body
        if (Array.isArray(req.files) && req.files.length > 0) {
          const formData = new FormData();

          // Add properly typed JSON data as a string field
          formData.append("data", JSON.stringify(typedBody));

          // Add files
          req.files.forEach((file) => {
            formData.append(file.fieldname, fs.createReadStream(file.path), {
              filename: file.originalname,
              contentType: file.mimetype,
            });
          });

          // Send the request with axios
          const response = await axios({
            method: req.method,
            url: url,
            data: formData,
            headers: {
              ...formData.getHeaders(),
              ...(req.headers.authorization && {
                Authorization: req.headers.authorization,
              }),
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: () => true,
          });

          // Clean up temporary files
          if (Array.isArray(req.files)) {
            for (const file of req.files) {
              try {
                fs.unlinkSync(file.path);
              } catch (error) {
                console.error(
                  `Failed to delete temp file ${file.path}:`,
                  error
                );
              }
            }
          }

          return res.status(response.status).json(response.data);
        } else {
          // No files, just send JSON data
          const response = await axios({
            method: req.method,
            url: url,
            data: typedBody,
            headers: {
              "Content-Type": "application/json",
              ...(req.headers.authorization && {
                Authorization: req.headers.authorization,
              }),
            },
            validateStatus: () => true,
          });

          return res.status(response.status).json(response.data);
        }
      }

      // For non-product endpoints, continue with the regular form data approach
      const formData = new FormData();

      // Add form fields
      if (req.body) {
        Object.keys(req.body).forEach((key) => {
          if (key === "address" && typeof req.body[key] === "object") {
            const address = req.body[key];
            Object.keys(address).forEach((subKey) => {
              formData.append(`${key}[${subKey}]`, address[subKey]);
            });
          } else if (
            typeof req.body[key] === "object" &&
            req.body[key] !== null
          ) {
            const obj = req.body[key];
            Object.keys(obj).forEach((subKey) => {
              formData.append(`${key}[${subKey}]`, obj[subKey]);
            });
          } else {
            formData.append(key, req.body[key]);
          }
        });
      }

      // Add files
      if (Array.isArray(req.files)) {
        req.files.forEach((file) => {
          formData.append(file.fieldname, fs.createReadStream(file.path), {
            filename: file.originalname,
            contentType: file.mimetype,
          });
        });
      }

      // Send the request with axios
      const response = await axios({
        method: req.method,
        url: url,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          ...(req.headers.authorization && {
            Authorization: req.headers.authorization,
          }),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true,
      });

      // Clean up temporary files
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error(`Failed to delete temp file ${file.path}:`, error);
          }
        }
      }

      return res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Error in multipart request:", error);

      // Clean up temporary files
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error(`Failed to delete temp file ${file.path}:`, error);
          }
        }
      }

      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }

      return res.status(500).json({
        error: "Gateway Error",
        message: error.message || "Unknown error occurred",
      });
    }
  });
};
// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "API Gateway is running" });
});

// Auth Service routes
app.all("/api/auth/*", (req, res) => {
  const targetPath = req.url.replace("/api/auth", "/api/v1/auth");
  return forwardRequest(req, res, AUTH_SERVICE, targetPath);
});

app.all("/api/v1/auth/*", (req, res) => {
  return forwardRequest(req, res, AUTH_SERVICE, req.url);
});

// Product Service routes
app.all("/api/products*", (req, res) => {
  const targetPath = req.url.replace("/api/products", "/api/v1/product");
  return forwardRequest(req, res, PRODUCT_SERVICE, targetPath);
});

app.all("/api/v1/product*", (req, res) => {
  return forwardRequest(req, res, PRODUCT_SERVICE, req.url);
});

app.all("/api/v1/categories*", (req, res) => {
  return forwardRequest(req, res, PRODUCT_SERVICE, req.url);
});

// Cart Service routes
app.all("/api/v1/cart*", (req, res) => {
  const targetPath = req.url.replace("/api/cart", "");
  return forwardRequest(req, res, CART_SERVICE, targetPath);
});

// Order Service routes
app.all("/api/v1/orders*", (req, res) => {
  const targetPath = req.url.replace("/api/orders", "/api/v1/order");
  return forwardRequest(req, res, ORDER_SERVICE, targetPath);
});

app.all("/api/v1/order*", (req, res) => {
  return forwardRequest(req, res, ORDER_SERVICE, req.url);
});

// Review Service routes
app.all("/api/v1/reviews*", (req, res) => {
  const targetPath = req.url.replace("/api/reviews", "/api/v1/review");
  return forwardRequest(req, res, REVIEW_SERVICE, targetPath);
});

app.all("/api/v1/review*", (req, res) => {
  return forwardRequest(req, res, REVIEW_SERVICE, req.url);
});

// Webhook endpoint (usually for Stripe)
app.all("/webhook", (req, res) => {
  return forwardRequest(req, res, ORDER_SERVICE, "/webhook");
});

// 404 handler
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Route not found" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log("Service URLs:");
  console.log(`- Auth: ${AUTH_SERVICE}`);
  console.log(`- Product: ${PRODUCT_SERVICE}`);
  console.log(`- Cart: ${CART_SERVICE}`);
  console.log(`- Order: ${ORDER_SERVICE}`);
  console.log(`- Review: ${REVIEW_SERVICE}`);
});

export default app;
