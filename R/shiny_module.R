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
  if (!requireNamespace("shiny", quietly = TRUE)) {
    stop('profvis_ui requires the shiny package.')
  }
  ns <- shiny::NS(id)

  style <- htmltools::css(
    padding = "6px",
    white_space = "nowrap",
    top = "-1px",
    border_top_left_radius = "0",
    border_top_right_radius = "0",
    box_shadow = "none",
    z_index = 9000
  )

  shiny::fixedPanel(
    top = 0, left = -200, width = "auto", height = "auto",
    class = "profvis-module-container well", style = style, draggable = TRUE,

    shiny::uiOutput(ns("button_group"), class = "btn-group")
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
  if (!requireNamespace("shiny", quietly = TRUE)) {
    stop('profvis_server requires the shiny package.')
  }
  # Whether we're currently profiling
  profiling <- shiny::reactiveVal(FALSE)
  # The current/most recent profile
  current_profile <- shiny::reactiveVal(NULL)

  shiny::setBookmarkExclude(c("start_rprof", "browse", "dl_rprof", "dl_profvis", "download"))

  observeEvent(input$start_rprof, {
    if (!profiling()) {
      proffile <- file.path(dir, strftime(Sys.time(), "%Y-%m-%d_%H-%M-%S.Rprof"))
      Rprof(proffile,
        interval = 0.01, line.profiling = TRUE,
        gc.profiling = TRUE, memory.profiling = TRUE)
      current_profile(proffile)
      profiling(TRUE)
    }
  })

  output$button_group <- renderUI({
    profiling()

    ns <- session$ns

    isolate({
      browseBtn <- shiny::actionButton(class = "btn-xs", ns("browse"), NULL, shiny::icon("list-ul"))

      if (!profiling()) {
        tagList(
          shiny::actionButton(class = "btn-xs", ns("start_rprof"), "Start profiling", shiny::icon("play")),
          browseBtn,
          singleton(shiny::includeScript(system.file("shinymodule/draggable-helper.js", package = "profvis")))
        )
      } else {
        # Register a URL for the "Stop Recording" button to go to.
        # Requesting this URL will stop the current profiling session, update
        # the profiling() reactiveVal, and return a new profvis.
        url <- session$registerDataObj("stop_profvis_module", list(), function(data, req) {
          isolate({
            Rprof(NULL)
            profiling(FALSE)

            # profiling(FALSE) should cause a flushReact, but doesn't. This
            # invalidateLater is a hack to force one (since it's inside an
            # isolate, it otherwise has no effect).
            invalidateLater(50)

            if (!is.null(current_profile())) {
              stop("Invalid state detected")
            }

            # Create a profvis and save it to a self-contained temp .html file
            p <- profvis(prof_input = current_profile())
            outfile <- tempfile("profvis", fileext = ".html")
            htmlwidgets::saveWidget(p, outfile)

            # Return as HTML. Since owned=TRUE, httpuv will take care of deleting
            # the temp file when it's done streaming it to the client.
            list(
              status = 200L,
              headers = list(
                "Content-Type" = "text/html;charset=utf-8"
              ),
              body = list(
                file = outfile,
                owned = TRUE
              )
            )
          })
        })

        tagList(
          htmltools::tags$a(class = "btn btn-default btn-xs", target = "_blank", href = url, shiny::icon("stop"), "Stop profiling"),
          browseBtn
        )
      }
    })
  })

  shiny::observeEvent(input$browse, {
    ns <- session$ns

    shiny::showModal(shiny::modalDialog(
      shiny::uiOutput(ns("download_select")),
      shiny::downloadButton(ns("dl_rprof"), "Download as Rprof", class = "btn-xs"),
      shiny::downloadButton(ns("dl_profvis"), "Download as profvis", class = "btn-xs")
    ))
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

  # Validate input$download so we don't just let the user download whatever
  # file they want from the server.
  download <- reactive({
    dl <- input$download
    validate(need(isTRUE(dl %in% dir(dir, pattern = "\\.Rprof$")), "Illegal download or not found"))
    dl
  })

  output$dl_rprof <- shiny::downloadHandler(
    filename = function() {
      file.path(dir, download())
    },
    content = function(file) {
      file.copy(
        file.path(dir, download()),
        file
      )
    }
  )

  output$dl_profvis <- shiny::downloadHandler(
    filename = function() {
      file.path(dir, sub("Rprof$", "html", download()))
    },
    content = function(file) {
      p <- profvis(prof_input = download())
      htmlwidgets::saveWidget(p, file)
    }
  )
}
