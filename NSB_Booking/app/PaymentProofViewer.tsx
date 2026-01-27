// PaymentProofViewer.tsx  
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
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../src/services/config";

export default function PaymentProofViewer() {
  const { url } = useLocalSearchParams<{ url?: string }>();

  const [loadingView, setLoadingView] = useState(true);
  const [opening, setOpening] = useState(false);

  // Build FULL URL safely
  const fullUrl = useMemo(() => {
    if (!url) return "";
    const u = String(url);
    if (u.startsWith("http")) return u;
    return `${API_URL}${u.startsWith("/") ? u : `/${u}`}`;
  }, [url]);

  // ✅ Encode URL to handle spaces/special characters
  const safeUrl = useMemo(() => {
    if (!fullUrl) return "";
    return encodeURI(fullUrl);
  }, [fullUrl]);

  const isPdf = useMemo(() => safeUrl.toLowerCase().endsWith(".pdf"), [safeUrl]);

  useEffect(() => {
    if (isPdf) setLoadingView(false);
  }, [isPdf]);

  const goBackSafe = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/AdminReservations");
  };

  const openFile = async () => {
    try {
      setOpening(true);

      if (!safeUrl) {
        Alert.alert("Error", "File URL is missing");
        return;
      }

      if (Platform.OS === "web") {
        window.open(safeUrl, "_blank");
        return;
      }

      await Linking.openURL(safeUrl);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Unable to open file");
    } finally {
      setOpening(false);
    }
  };

  if (!safeUrl) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "#fff" }}>No payment proof available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.headerBack} onPress={goBackSafe}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
    </TouchableOpacity>


      <Text style={styles.title}>Payment Proof</Text>

      <View style={styles.viewer}>
        {loadingView && !isPdf && (
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
            source={{ uri: safeUrl }} // ✅ use encoded url here
            style={styles.image}
            onLoadEnd={() => setLoadingView(false)}
            onError={() => {
              setLoadingView(false);
              Alert.alert("Error", "Unable to load image");
            }}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.download, opening && { opacity: 0.7 }]}
        onPress={openFile}
        disabled={opening}
      >
        {opening ? (
          <ActivityIndicator color="#00113D" />
        ) : (
          <>
            <Ionicons name="open-outline" size={18} color="#00113D" />
            <Text style={styles.downloadText}>{isPdf ? "Open PDF" : "Open / Download"}</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.url} numberOfLines={2}>
        {safeUrl}
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
  headerBack: {
  position: "absolute",
  top: 30,
  left: 16,
  zIndex: 20,
  padding: 6,
  backgroundColor: "rgba(255,255,255,0.09)",
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
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
    padding: 16,
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
