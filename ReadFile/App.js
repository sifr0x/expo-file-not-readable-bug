import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Alert, ScrollView } from "react-native";
import { Linking } from "react-native";
import * as FileSystem from "expo-file-system";

const UPLOAD_URL = "https://datahuys.net/upload.php";

export default function App() {
  const [lastFile, setLastFile] = useState(null);
  const [logs, setLogs] = useState([]);

  // Custom logging function
  const log = (message, type = "info") => {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const logEntry = {
      timestamp,
      message:
        typeof message === "object"
          ? JSON.stringify(message, null, 2)
          : message,
      type,
    };
    setLogs((currentLogs) => [logEntry, ...currentLogs]);
    console.log(`${timestamp} [${type}]:`, message);
  };

  const uploadFile = async (fileUri, fileContent) => {
    try {
      log("Starting file upload...");

      const formData = new FormData();
      formData.append("file", {
        uri: fileUri,
        type: "application/pdf",
        name: fileUri.split("/").pop() || "document.pdf",
      });

      const response = await fetch(UPLOAD_URL, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const result = await response.json();

      if (result.success) {
        log(`Upload successful: ${result.data.filename}`);
        Alert.alert("Success", "File uploaded successfully");
        return true;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      log(`Upload failed: ${error.message}`, "error");
      Alert.alert("Upload Error", error.message);
      return false;
    }
  };

  const handleDeeplink = async (contentUri) => {
    try {
      log("Handling deep link for URI: " + contentUri);

      // Decode the URI to handle special characters
      const decodedUri = decodeURI(contentUri);
      log("Decoded URI: " + decodedUri);

      // Check if file exists and get more info
      const fileInfo = await FileSystem.getInfoAsync(decodedUri, {
        size: true,
        md5: true,
      });
      log("File info: " + JSON.stringify(fileInfo));

      if (!fileInfo.exists) {
        log("File does not exist: " + decodedUri, "error");
        Alert.alert("Error", "File does not exist");
        return;
      }

      // Try different encodings
      const encodings = [
        FileSystem.EncodingType.UTF8,
        FileSystem.EncodingType.Base64,
        FileSystem.EncodingType.ASCII,
      ];

      let fileContent = null;
      let successfulEncoding = null;

      for (const encoding of encodings) {
        try {
          log(`Trying to read with ${encoding} encoding...`);
          fileContent = await FileSystem.readAsStringAsync(decodedUri, {
            encoding: encoding,
          });

          // Basic validation of file content
          if (fileContent && fileContent.length > 0) {
            log(
              `Success with ${encoding}! Content length: ${fileContent.length}`,
            );
            log(`First 50 chars: ${fileContent.substring(0, 50)}`);
            successfulEncoding = encoding;
            break; // Exit the loop once we have successful reading
          }
        } catch (encError) {
          log(`Failed with ${encoding}: ${encError.message}`, "error");
        }
      }

      if (!fileContent || !successfulEncoding) {
        log("All encoding attempts failed", "error");
        Alert.alert("Error", "Could not read file with any encoding");
        return;
      }

      // Update UI with file info
      setLastFile({
        path: decodedUri,
        header: fileContent.substring(0, 50),
        encoding: successfulEncoding,
      });

      // Proceed with upload
      const uploadSuccess = await uploadFile(decodedUri, fileContent);
      if (uploadSuccess) {
        log("File processing completed successfully");
      }
    } catch (error) {
      log("Error in handleDeeplink: " + error.message, "error");
      Alert.alert("Error", "Failed to process file: " + error.message);
    }
  };

  useEffect(() => {
    let subscription;

    const setupInitial = async () => {
      try {
        log("Setting up deep link handling...");

        subscription = Linking.addEventListener("url", (event) => {
          log("Received URL event: " + JSON.stringify(event));

          const url = event.url;
          if (url.startsWith("file://") || url.startsWith("content://")) {
            handleDeeplink(url);
          } else {
            log("Unsupported URL scheme: " + url, "warn");
          }
        });

        const initialUri = await Linking.getInitialURL();
        log("Initial URI: " + initialUri);

        if (initialUri) {
          if (
            initialUri.startsWith("content://") ||
            initialUri.startsWith("file://")
          ) {
            handleDeeplink(initialUri);
          } else {
            log("Initial URI has unsupported scheme: " + initialUri, "warn");
          }
        }
      } catch (error) {
        log("Error in setupInitial: " + error.message, "error");
        Alert.alert(
          "Setup Error",
          "Failed to initialize app: " + error.message,
        );
      }
    };

    setupInitial();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PDF Deep Link Handler</Text>

      {lastFile && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileInfoText}>Last processed file:</Text>
          <Text style={styles.fileInfoText}>Path: {lastFile.path}</Text>
          <Text style={styles.fileInfoText}>Header: {lastFile.header}</Text>
          <Text style={styles.fileInfoText}>Encoding: {lastFile.encoding}</Text>
        </View>
      )}

      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Debug Logs:</Text>
        <ScrollView style={styles.logs}>
          {logs.map((log, index) => (
            <Text
              key={index}
              style={[
                styles.logEntry,
                log.type === "error" && styles.errorLog,
                log.type === "warn" && styles.warnLog,
              ]}
            >
              {log.timestamp} - {log.message}
            </Text>
          ))}
        </ScrollView>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  fileInfo: {
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    marginBottom: 20,
  },
  fileInfoText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 5,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 10,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  logs: {
    flex: 1,
  },
  logEntry: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 2,
    color: "#333",
  },
  errorLog: {
    color: "#ff0000",
  },
  warnLog: {
    color: "#ffa500",
  },
});
