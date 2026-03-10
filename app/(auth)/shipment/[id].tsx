// Archivo: app/(auth)/shipment/[id].tsx
// Descripcion: Pantalla de detalle de carga. Muestra informacion, historial, documentos y permite subir/abrir documentos.

import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../../components/LogoCorner';
import { supabase } from '../../../lib/supabase';

// Modelo de datos de la tabla shipments usado por esta vista.
type Shipment = {
  id: string;
  do_number: string;
  shipment_type: string;
  origin: string;
  destination: string;
  etd: string | null;
  eta: string | null;
  incoterm?: string;
  current_status?: string;
  current_location?: string;
  exporter?: string;
  consignee?: string;
  air_waybill?: string;
  flight_vessel?: string;
  container_number?: string;
  carrier?: string;
  client_id: string;
};

// Modelo del historial de actualizaciones de una carga.
type ShipmentUpdate = {
  id: string;
  shipment_id: string;
  created_at: string;
  status?: string;
  location?: string;
  observation?: string;
};

// Modelo de documentos asociados a una carga.
type Document = {
  id: string;
  shipment_id: string;
  file_name: string;
  file_size: number;
  file_path?: string | null;
  storage_path?: string | null;
};

const COLORS = {
  blue: '#1E5F99',
  blueMid: '#2B6AA0',
  blueDark: '#1B2A3A',
  orange: '#F28A07',
  cream: '#FFF6EC',
  creamGlass: 'rgba(255, 246, 236, 0.92)',
  textSecondary: '#6B7C8F',
  placeholder: '#8B98A6',
  border: '#D7E3EE',
};

export default function ShipmentDetail() {
  // ID de carga recibido por ruta dinamica /shipment/[id].
  const { id } = useLocalSearchParams();

  // Datos principales del embarque actual.
  const [shipment, setShipment] = useState<Shipment | null>(null);
  // Historial de cambios (estado, ubicacion y observaciones).
  const [updates, setUpdates] = useState<ShipmentUpdate[]>([]);
  // Documentos asociados a la carga.
  const [documents, setDocuments] = useState<Document[]>([]);

  // Estado de carga inicial de la pantalla.
  const [loading, setLoading] = useState(true);
  // Estado de progreso para subida de archivo.
  const [uploadingDocument, setUploadingDocument] = useState(false);
  // ID del documento que se esta intentando abrir.
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);

  // Permisos del usuario autenticado.
  const [isInternal, setIsInternal] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Carga datos cada vez que cambia el id de la ruta.
  useEffect(() => {
    void loadShipmentDetails();
  }, [id]);

  // Trae usuario, perfil, carga, historial y documentos visibles.
  const loadShipmentDetails = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      setUserId(user.id);

      // Determina si el usuario es interno para habilitar acciones de edicion/subida.
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      setIsInternal(profile?.is_internal || false);

      // Carga el detalle de la carga solicitada.
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (shipmentError) throw shipmentError;

      setShipment(shipmentData);
      setIsOwner(shipmentData.client_id === user.id);

      // Solo internos o dueno ven historial y documentos completos.
      if (shipmentData.client_id === user.id || profile?.is_internal) {
        const { data: updatesData } = await supabase
          .from('shipment_updates')
          .select('*')
          .eq('shipment_id', id)
          .order('created_at', { ascending: false });

        setUpdates(updatesData || []);

        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('shipment_id', id);

        setDocuments(docsData || []);
      }
    } catch (error) {
      console.error('Error cargando detalle de carga:', error);
      Alert.alert('Error', 'No se pudo cargar el detalle de la carga');
    } finally {
      setLoading(false);
    }
  };

  // Selecciona y sube un documento al bucket `documents`.
  const handleUploadDocument = async () => {
    if (!isInternal) {
      Alert.alert('Error', 'Solo usuarios internos pueden subir documentos');
      return;
    }

    const shipmentId = String(id ?? '');
    if (!shipmentId) {
      Alert.alert('Error', 'ID de carga invalido');
      return;
    }

    try {
      setUploadingDocument(true);

      const picker = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (picker.canceled || !picker.assets?.length) {
        return;
      }

      const asset = picker.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const safeName = (asset.name || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectPath = `${shipmentId}/${Date.now()}_${safeName}`;

      const { data: uploaded, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(objectPath, blob, {
          contentType: asset.mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError || !uploaded?.path) {
        throw uploadError || new Error('No se pudo subir el archivo');
      }

      // Inserta metadata minima obligatoria en la tabla documents.
      const baseInsert = {
        shipment_id: shipmentId,
        file_name: asset.name || safeName,
        file_size: asset.size ?? 0,
        file_path: uploaded.path,
      };

      const { data: insertedDoc, error: insertError } = await supabase
        .from('documents')
        .insert(baseInsert)
        .select('*')
        .single();

      if (insertError) {
        // Si falla DB, intenta limpiar el archivo subido para no dejar basura en storage.
        try {
          await supabase.storage.from('documents').remove([uploaded.path]);
        } catch {
          // No bloquea: el error principal es el de base de datos.
        }
        throw insertError;
      }

      // Intento opcional de metadatos extra (si las columnas existen en tu esquema).
      if (insertedDoc?.id) {
        await supabase
          .from('documents')
          .update({
            storage_path: uploaded.path,
            uploaded_by: userId,
          })
          .eq('id', insertedDoc.id);
      }

      // Refleja el nuevo documento inmediatamente en pantalla.
      setDocuments((prev) => [
        ...prev,
        {
          id: insertedDoc?.id ? String(insertedDoc.id) : `${Date.now()}`,
          shipment_id: shipmentId,
          file_name: asset.name || safeName,
          file_size: asset.size ?? 0,
          file_path: uploaded.path,
          storage_path: uploaded.path,
        },
      ]);

      Alert.alert('Exito', 'Documento subido correctamente');
    } catch (error) {
      console.error('Error subiendo documento:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo subir el documento');
    } finally {
      setUploadingDocument(false);
    }
  };

  // Resuelve la ruta en storage para poder generar URL firmada.
  const resolveStoragePath = async (doc: Document) => {
    if (doc.file_path) return doc.file_path;
    if (doc.storage_path) return doc.storage_path;

    const shipmentId = String(id ?? '');
    if (!shipmentId) return null;

    // Fallback para documentos antiguos: intenta ubicar por nombre dentro de la carpeta de carga.
    const { data: objects, error } = await supabase.storage
      .from('documents')
      .list(shipmentId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !objects?.length) return null;

    const safeName = doc.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const match = objects.find((item) => item.name === safeName || item.name.endsWith(`_${safeName}`));

    return match ? `${shipmentId}/${match.name}` : null;
  };

  // Genera URL firmada y abre el documento en el visor externo del dispositivo.
  const handleOpenDocument = async (doc: Document) => {
    try {
      setOpeningDocumentId(doc.id);
      const path = await resolveStoragePath(doc);

      if (!path) {
        Alert.alert('Error', 'No se encontro la ruta del documento');
        return;
      }

      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 60 * 30);

      if (error || !data?.signedUrl) {
        throw error || new Error('No se pudo crear el enlace del documento');
      }

      const canOpen = await Linking.canOpenURL(data.signedUrl);
      if (!canOpen) {
        throw new Error('El dispositivo no puede abrir este documento');
      }

      await Linking.openURL(data.signedUrl);
    } catch (error) {
      console.error('Error abriendo documento:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo abrir el documento');
    } finally {
      setOpeningDocumentId(null);
    }
  };

  // Navegacion de regreso segura con alternativa al dashboard.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.center}>
        <Text>Carga no encontrada</Text>
      </View>
    );
  }

  // Solo muestra actualizaciones con contenido util.
  const visibleUpdates = updates.filter((update) =>
    Boolean(update.status || update.location || update.observation),
  );

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>Detalle de Carga</Text>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={backFunction}>
            <Text style={styles.topActionText}>Volver</Text>
          </TouchableOpacity>
          {isInternal && (
            <TouchableOpacity onPress={() => router.push(`/editShipment/${id}`)}>
              <Text style={styles.topActionText}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Informacion principal de la carga */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informacion</Text>
          <InfoRow label="DO Number" value={shipment.do_number} />
          <InfoRow label="Via" value={shipment.shipment_type} />
          <InfoRow label="Origen" value={shipment.origin} />
          <InfoRow label="Destino" value={shipment.destination} />
          <InfoRow label="ETD" value={shipment.etd || ''} />
          <InfoRow label="ETA" value={shipment.eta || ''} />
          {shipment.incoterm && <InfoRow label="Incoterm" value={shipment.incoterm} />}
          <InfoRow label="Estado Actual" value={shipment.current_status || ''} />
          <InfoRow label="Ubicacion Actual" value={shipment.current_location || ''} />
          <InfoRow label="Exportador" value={shipment.exporter || ''} />
          <InfoRow label="Consignatario" value={shipment.consignee || ''} />
          {shipment.air_waybill && <InfoRow label="Guia/Booking" value={shipment.air_waybill} />}
          {shipment.flight_vessel && <InfoRow label="Vuelo/Motonave" value={shipment.flight_vessel} />}
          {shipment.container_number && <InfoRow label="Contenedor" value={shipment.container_number} />}
          {shipment.carrier && <InfoRow label="Naviera/Aerolinea" value={shipment.carrier} />}
        </View>

        {/* Historial */}
        {visibleUpdates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            {visibleUpdates.map((update) => (
              <View key={update.id} style={styles.updateCard}>
                <Text style={styles.updateDate}>{new Date(update.created_at).toLocaleDateString()}</Text>
                {update.status && <Text style={styles.updateStatus}>{update.status}</Text>}
                {update.location && <Text style={styles.updateLocation}>{update.location}</Text>}
                {update.observation && <Text style={styles.updateObs}>{update.observation}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Documentos */}
        {documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documentos</Text>
            {documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                onPress={() => handleOpenDocument(doc)}
                disabled={openingDocumentId === doc.id}
              >
                <Text style={styles.docName}>{doc.file_name}</Text>
                <Text style={styles.docSize}>
                  {openingDocumentId === doc.id ? 'Abriendo...' : `${(doc.file_size / 1024).toFixed(2)} KB`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Accion para internos */}
        {isInternal && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.uploadButton, uploadingDocument && styles.uploadButtonDisabled]}
              onPress={handleUploadDocument}
              disabled={uploadingDocument}
            >
              <Text style={styles.uploadButtonText}>
                {uploadingDocument ? 'Subiendo...' : 'Subir documento'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

// Renderiza una fila label:valor y oculta la fila si el valor esta vacio.
function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clase personalizada: imagen de fondo de pantalla completa.
  background: { width: '100%', height: '100%' },
  // Clase personalizada: contenedor raiz de la pantalla.
  container: { flex: 1, backgroundColor: 'transparent' },
  // Clase personalizada: scroll principal para permitir contenido largo.
  scroll: { flex: 1 },
  // Clase personalizada: area interna con separacion respecto al header fijo.
  content: { zIndex: 1, paddingBottom: 20, paddingTop: 100 },
  // Clase personalizada: centrado para estados de carga o no encontrado.
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Clase personalizada: header superior fijo con titulo y acciones.
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 4,
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.orange,
  },
  // Clase personalizada: titulo principal del detalle.
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  // Clase personalizada: contenedor horizontal para botones Volver/Editar.
  topActions: {
    position: 'absolute',
    right: 16,
    top: 25,
    flexDirection: 'row',
    gap: 8,
  },
  // Clase personalizada: texto de acciones del encabezado.
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  // Clase personalizada: bloque de contenido agrupado (informacion, historial, documentos).
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
  },
  // Clase personalizada: titulo de cada seccion.
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  // Clase personalizada: fila de informacion clave-valor.
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  // Clase personalizada: etiqueta de la fila de informacion.
  infoLabel: { width: 140, fontWeight: '600', color: '#666' },
  // Clase personalizada: valor asociado a la etiqueta de informacion.
  infoValue: { flex: 1, color: '#333' },
  // Clase personalizada: tarjeta de una actualizacion de historial.
  updateCard: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 10,
  },
  // Clase personalizada: fecha de la actualizacion.
  updateDate: { fontSize: 12, color: '#999', marginBottom: 5 },
  // Clase personalizada: estado registrado en la actualizacion.
  updateStatus: { fontWeight: '600', marginBottom: 3 },
  // Clase personalizada: ubicacion registrada en la actualizacion.
  updateLocation: { color: '#666', marginBottom: 3 },
  // Clase personalizada: observacion de la actualizacion.
  updateObs: { color: '#333' },
  // Clase personalizada: tarjeta clickeable de documento.
  docCard: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 8,
  },
  // Clase personalizada: nombre del archivo.
  docName: { fontWeight: '600', marginBottom: 4 },
  // Clase personalizada: tamano o estado de apertura del documento.
  docSize: { fontSize: 12, color: '#999' },
  // Clase personalizada: boton para subir documento.
  uploadButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  // Clase personalizada: opacidad reducida para boton deshabilitado.
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  // Clase personalizada: texto del boton de subida.
  uploadButtonText: {
    color: COLORS.cream,
    fontWeight: '700',
  },
});

