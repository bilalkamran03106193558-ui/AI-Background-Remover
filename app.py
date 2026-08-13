from flask import Flask, render_template, request, send_file
from rembg import remove
import io

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/remove-background", methods=["POST"])
def remove_background():

    if "image" not in request.files:
        return {"error": "No image uploaded"}, 400

    file = request.files["image"]

    if file.filename == "":
        return {"error": "No image selected"}, 400

    try:
        input_data = file.read()

        output_data = remove(input_data)

        return send_file(
            io.BytesIO(output_data),
            mimetype="image/png",
            as_attachment=False,
            download_name="background-removed.png"
        )

    except Exception as e:
        print("ERROR:", e)
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(debug=True)