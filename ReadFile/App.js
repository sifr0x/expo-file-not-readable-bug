import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Alert } from "react-native";
import { Linking } from "react-native";
import * as FileSystem from "expo-file-system";

export default function App() {
  const [lastFile, setLastFile] = useState(null);

  const handleDeeplink = async (contentUri) => {
    try {
      console.log("Handling deep link for URI:", contentUri);

      // Decode the URI to handle special characters
      const decodedUri = decodeURI(contentUri);

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(decodedUri);
      console.log("File info:", fileInfo);

      if (!fileInfo.exists) {
        console.error("File does not exist:", decodedUri);
        Alert.alert("Error", "File does not exist");
        return;
      }

      // Generate a unique filename
      const timestamp = Date.now();
      const fileUriIncomplete =
        FileSystem.cacheDirectory + `deep-link-${timestamp}.pdf`;

      // Copy the file
      await FileSystem.copyAsync({
        from: decodedUri,
        to: fileUriIncomplete,
      });

      console.log("File copied successfully to:", fileUriIncomplete);

      // Read file contents
      try {
        const body = await FileSystem.readAsStringAsync(fileUriIncomplete);
        const header = body.substring(0, 20);
        console.log("File header:", header);

        setLastFile({
          path: fileUriIncomplete,
          header: header,
        });

        Alert.alert("Success", "File processed successfully");
      } catch (readError) {
        console.error("Error reading file:", readError);
        Alert.alert("Error", "Could not read file contents");
      }
    } catch (error) {
      console.error("Error in handleDeeplink:", error);
      Alert.alert("Error", "Failed to process file: " + error.message);
    }
  };

  useEffect(() => {
    let subscription;

    const setupInitial = async () => {
      try {
        // Set up linking listener
        subscription = Linking.addEventListener("url", (event) => {
          console.log("Received URL event:", event);

          const url = event.url;
          if (url.startsWith("file://") || url.startsWith("content://")) {
            handleDeeplink(url);
          } else {
            console.log("Unsupported URL scheme:", url);
          }
        });

        // Check for initial URL
        const initialUri = await Linking.getInitialURL();
        console.log("Initial URI:", initialUri);

        if (initialUri) {
          if (
            initialUri.startsWith("content://") ||
            initialUri.startsWith("file://")
          ) {
            handleDeeplink(initialUri);
          } else {
            console.log("Initial URI has unsupported scheme:", initialUri);
          }
        }
      } catch (error) {
        console.error("Error in setupInitial:", error);
        Alert.alert(
          "Setup Error",
          "Failed to initialize app: " + error.message,
        );
      }
    };

    setupInitial();

    // Cleanup function
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Debug function to check file system access
  useEffect(() => {
    const checkFileSystem = async () => {
      try {
        console.log("Cache directory:", FileSystem.cacheDirectory);
        console.log("Document directory:", FileSystem.documentDirectory);

        // Check if directories are readable
        const cacheInfo = await FileSystem.getInfoAsync(
          FileSystem.cacheDirectory,
        );
        const documentInfo = await FileSystem.getInfoAsync(
          FileSystem.documentDirectory,
        );

        console.log("Cache directory info:", cacheInfo);
        console.log("Document directory info:", documentInfo);
      } catch (error) {
        console.error("Error checking file system:", error);
      }
    };

    checkFileSystem();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PDF Deep Link Handler</Text>

      <Text style={styles.subtitle}>
        Open a PDF file from another app to test deep linking
      </Text>

      {lastFile && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileInfoText}>Last processed file:</Text>
          <Text style={styles.fileInfoText}>Path: {lastFile.path}</Text>
          <Text style={styles.fileInfoText}>Header: {lastFile.header}</Text>
        </View>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 30,
  },
  fileInfo: {
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    width: "100%",
    marginTop: 20,
  },
  fileInfoText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 5,
  },
});
