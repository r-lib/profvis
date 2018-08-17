#' Profvis UI for Shiny Apps
#'
#' Provides the UI for the Profvis module in Shiny apps. This module creates a
#' profvis interface to profile parts of a shiny app and save the profvis or
#' Rprof output. Used with \code{\link{profvis_server}}. This function requires
#' the \code{shiny} package.
#'
#' @param id Output id from \code{profvis_server}.
#'
#' @examples
#' if(interactive()) {
#'   shinyApp(
#'     fluidPage(
#'       plotOutput("plot"),
#'       actionButton("new", "New plot"),
#'       profvis_ui("profiler")
#'     ),
#'     function(input, output, session) {
#'       callModule(profvis_server, "profiler")
#'
#'       output$plot <- renderPlot({
#'         input$new
#'         ggplot(diamonds, aes(carat, price)) + geom_point()
#'       })
#'     }
#'   )
#' }
#'
#' @export
profvis_ui <- function(id) {
  # TODO: Make into floating panel, add hamburger menu for downloads?
  # TODO: should this check for shiny, or add as Imports?
  if (!requireNamespace("shiny", quietly = TRUE)) {
    stop('profvis_ui requires the shiny package.')
  }
  ns <- shiny::NS(id)

  shiny::wellPanel(
    shiny::actionButton(ns("toggle"), "Start profiling", shiny::icon("play")),
    shiny::br(),
    shiny::br(),
    shiny::uiOutput(ns("download_select")),
    shiny::downloadButton(ns("dl_rprof"), "Download as Rprof"),
    shiny::downloadButton(ns("dl_profvis"), "Download as profvis")
  )
}

#' Profvis Server for Shiny Apps
#'
#' Provides the server for the Profvis module in Shiny apps. This module creates
#' a profvis interface to profile parts of a shiny app and save the profvis or
#' Rprof output. Used with \code{\link{profvis_ui}}. This function requires the
#' \code{shiny} package.
#'
#' @param input,output,session Arguments used by
#'   \code{\link[shiny]{callModule}}.
#' @param dir Output directory to save Rprof files.
#'
#' @examples
#' if(interactive()) {
#'   shinyApp(
#'     fluidPage(
#'       plotOutput("plot"),
#'       actionButton("new", "New plot"),
#'       profvis_ui("profiler")
#'     ),
#'     function(input, output, session) {
#'       callModule(profvis_server, "profiler")
#'
#'       output$plot <- renderPlot({
#'         input$new
#'         ggplot(diamonds, aes(carat, price)) + geom_point()
#'       })
#'     }
#'   )
#' }
#'
#' @export
profvis_server <- function(input, output, session, dir = ".") {
  # TODO: should this check for shiny, or add as Imports?
  if (!requireNamespace("shiny", quietly = TRUE)) {
    stop('profvis_server requires the shiny package.')
  }
  profiling <- shiny::reactiveVal(FALSE)

  shiny::observeEvent(input$toggle, {
    if (!profiling()) {
      # Start profiling
      Rprof(file.path(dir, strftime(Sys.time(), "%Y-%m-%d_%H-%M-%S.Rprof")),
            interval = 0.01, line.profiling = TRUE,
            gc.profiling = TRUE, memory.profiling = TRUE)

      shiny::updateActionButton(session, "toggle", "Stop profiling", shiny::icon("stop"))

    } else {
      # Stop profiling
      Rprof(NULL)
      shiny::updateActionButton(session, "toggle", "Start profiling", icon("play"))
    }

    profiling(!profiling())
  })

  shiny::onSessionEnded(function() {
    # Make sure we stop profiling when session exits
    Rprof(NULL)
  })

  output$download_select <- shiny::renderUI({
    shiny::req(!profiling(), cancelOutput = TRUE)
    ns <- session$ns
    shiny::selectInput(ns("download"), "Select profile to download",
                choices = sort(dir(dir, pattern = "\\.Rprof$"), decreasing = TRUE)
    )
  })


  output$dl_rprof <- shiny::downloadHandler(
    filename = function() {
      file.path(dir, input$download)
    },
    content = function(file) {
      file.copy(
        file.path(dir, input$download),
        file
      )
    }
  )

  output$dl_profvis <- shiny::downloadHandler(
    filename = function() {
      file.path(dir, sub("Rprof$", "html", input$download))
    },
    content = function(file) {
      p <- profvis(prof_input = input$download)
      htmlwidgets::saveWidget(p, file)
    }
  )
}
