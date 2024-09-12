# Metricas

Esta aplicación es capaz de generar ciertas métricas usando [Prometheus](https://prometheus.io/). Puedes visualizar esta métrica en [Grafana](https://grafana.com/) con el siguiente dashboard:

* [scripts/grafana-dashboard.json](scripts/grafana-dashboard.json)


# Descripción General

## Messages

* **notify_rabbit_ack** Número total de ack dee mensajes por canal de notify

* **notify_rabbit_messages** Número total de mensajes por canal de notify
## Nodejs engine

### Active Handles

* **nodejs_active_handles** Número de identificadores de libuv activos agrupados por tipo de identificador (Socket && Server). Cada tipo de identificador es un nombre de clase C++.

* **nodejs_active_handles_total** Número total de handles activos.

### % CPU usage

* **process_cpu_user_seconds_total** Tiempo total de CPU del usuario empleado en segundos.

* **process_cpu_system_seconds_total** Tiempo total de CPU del sistema empleado en segundos.

* **process_cpu_seconds_total**  Tiempo total de CPU del usuario y del sistema empleado en segundos.

### Event loop lag

* **nodejs_eventloop_lag_seconds** Retraso del bucle de eventos en segundos.

### Memory 

#### External Memory

* **nodejs_external_memory_bytes** Node.js tamaño de la memoria externa en bytes.

#### Heap size

* **nodejs_heap_size_total_bytes** Tamaño total en bytes del Process heap.

* **nodejs_heap_size_used_bytes** Tamño en bytes del Process heap usado por Nodejs.

#### Process Memory

* **process_resident_memory_bytes** Tamaño de la memoria residente en bytes.

* **process_virtual_memory_bytes** Tamaño de la memoria virtual en bytes.

### Heap Space Size

#### Total

* **nodejs_heap_space_size_total_bytes** Tamaño total en bytes del almacenamiento dinámico de Node.js para procesos.
  * **read_only**
  * **new**
  * **old**
  * **code**
  * **map**
  * **large_object**
  * **code_large_object**
  * **new_large_object**

* **nodejs_heap_space_size_available_bytes** Tamaño en bytes del almacenamiento dinámico de Node.js para procesos disponible.
  * **read_only**
  * **new**
  * **old**
  * **code**
  * **map**
  * **large_object**
  * **code_large_object**
  * **new_large_object**

* **nodejs_heap_space_size_used_bytes** Tamaño en bytes del almacenamiento dinámico de Node.js para procesos usado.
  * **read_only**
  * **new**
  * **old**
  * **code**
  * **map**
  * **large_object**
  * **code_large_object**
  * **new_large_object**