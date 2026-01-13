import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_BASE } from "../src/services/api";

export default function PaymentProofViewer() {
  const { url } = useLocalSearchParams<{ url?: string }>();

  const [loadingView, setLoadingView] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // -------------------------
  // Build FULL URL safely
  // -------------------------
  const fullUrl = useMemo(() => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
  }, [url]);

  const isPdf = fullUrl.toLowerCase().endsWith(".pdf");

  const fileName = useMemo(() => {
    const name = fullUrl.split("/").pop() || "payment-proof";
    return name.includes(".") ? name : isPdf ? `${name}.pdf` : `${name}.jpg`;
  }, [fullUrl, isPdf]);

  // -------------------------
  // SAFE BACK (never stuck)
  // -------------------------
  const goBackSafe = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/AdminReservations");
    }
  };

  // -------------------------
  // DOWNLOAD (reliable)
  // -------------------------
  const downloadFile = async () => {
    try {
      setDownloading(true);

      // 🌐 WEB — always works
      if (Platform.OS === "web") {
        window.open(fullUrl, "_blank");
        return;
      }

      const dir =
        (FileSystem as any).documentDirectory ||
        (FileSystem as any).cacheDirectory;

      if (!dir) {
        Alert.alert("Error", "Storage not available");
        return;
      }

      const localPath = dir + fileName;

      const result = await FileSystem.downloadAsync(fullUrl, localPath);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri);
      } else {
        Alert.alert("Downloaded", result.uri);
      }
    } catch (e: any) {
      Alert.alert("Download failed", e.message || "Try again");
    } finally {
      setDownloading(false);
    }
  };

  // -------------------------
  // GUARD
  // -------------------------
  if (!fullUrl) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "#fff" }}>No payment proof available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* BACK */}
      <TouchableOpacity style={styles.back} onPress={goBackSafe}>
        <Ionicons name="chevron-back" size={30} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>Payment Proof</Text>

      {/* VIEWER */}
      <View style={styles.viewer}>
        {loadingView && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFB600" />
            <Text style={{ color: "#B8C4E6", marginTop: 10 }}>
              Loading file…
            </Text>
          </View>
        )}

        {isPdf ? (
          <View style={styles.pdfBox}>
            <Ionicons name="document-text-outline" size={60} color="#FFB600" />
            <Text style={styles.pdfText}>PDF Document</Text>
          </View>
        ) : (
          <Image
            source={{ uri: fullUrl }}
            style={styles.image}
            onLoadEnd={() => setLoadingView(false)}
            onError={() => {
              setLoadingView(false);
              Alert.alert("Error", "Unable to load image");
            }}
          />
        )}
      </View>

      {/* DOWNLOAD */}
      <TouchableOpacity
        style={[styles.download, downloading && { opacity: 0.7 }]}
        onPress={downloadFile}
        disabled={downloading}
      >
        {downloading ? (
          <ActivityIndicator color="#00113D" />
        ) : (
          <>
            <Ionicons name="download-outline" size={18} color="#00113D" />
            <Text style={styles.downloadText}>Download</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.url} numberOfLines={2}>
        {fullUrl}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#00113D",
    paddingTop: 55,
    paddingHorizontal: 16,
  },
  back: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 10,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },
  viewer: {
    flex: 1,
    backgroundColor: "#071642",
    borderRadius: 16,
    overflow: "hidden",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#071642",
    zIndex: 5,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  pdfBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pdfText: {
    color: "#fff",
    marginTop: 12,
    fontWeight: "900",
  },
  download: {
    backgroundColor: "#FFB600",
    marginVertical: 12,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  downloadText: {
    color: "#00113D",
    fontWeight: "900",
  },
  url: {
    color: "#8EA2D9",
    fontSize: 11,
    textAlign: "center",
  },
});
